async function openCal() {
  if (/.*:\/\/(twitter|x).com\/.*\/status\/.*/.test(window.location.href)) {
    const BASE_URL = "https://www.google.com/calendar/render?action=TEMPLATE&text=";
    const NL = "\n";
    const SELECTOR_CONTENT = 'article > div > div > div:nth-child(3) > div:nth-child(1)';
    const DEFAULT_EVENT_DURATION = 2;

    // 1. chrome.storage から設定を取得
    let eventDuration = DEFAULT_EVENT_DURATION;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      const storageData = await new Promise((resolve) => {
        chrome.storage.sync.get({ eventDuration: DEFAULT_EVENT_DURATION }, resolve);
      });
      eventDuration = storageData.eventDuration;
    }

    let TITLE = "予定あり";
    const contentElem = document.querySelector(SELECTOR_CONTENT);
    if (contentElem) {
      TITLE = contentElem.innerText.split('\n').shift();
    }
  
    let TEXT = "";
    if (contentElem && !contentElem.innerText.includes('返信先')) {
      TEXT = contentElem.innerText + NL;
      let urls = [...document.querySelectorAll(`${SELECTOR_CONTENT} a`)].map((a) => a.href).filter((url) => !url.includes('hashtag'));
      for (let i = 0; i < urls.length; i++) {
        let expandedUrl = await tenkai(urls[i]);
        if (expandedUrl) {
          urls[i] = expandedUrl;
        }      
      }
      TEXT += NL + urls.join(NL) + NL;
    }
  
    const TWEET_URL = window.location.href;
  
    // --- 2. 修正版・高精度日時抽出ロジック ---
    let startStr = "";
    let endStr = "";

    if (contentElem) {
      const rawText = contentElem.innerText;
      const candidates = parseFlexibleDateTime(rawText, eventDuration);

      if (candidates.length > 0) {
        let selected = candidates[0];

        // 候補が複数ある場合はダイアログで選択
        if (candidates.length > 1) {
          let promptMessage = "登録したい日時パターンを選択してください（番号を入力）:\n";
          candidates.forEach((c, index) => {
            promptMessage += `${index + 1}: ${c.label}\n`;
          });
          
          const userInput = prompt(promptMessage, "1");
          if (userInput === null) return; // キャンセル時
          
          const selectedIndex = parseInt(userInput, 10) - 1;
          if (selectedIndex >= 0 && selectedIndex < candidates.length) {
            selected = candidates[selectedIndex];
          }
        }

        startStr = selected.startStr;
        endStr = selected.endStr;
      }
    }

    // 日時が全く取得できなかった場合のフォールバック（現在時刻から2時間）
    if (!startStr || !endStr) {
      const now = new Date();
      const future = new Date(now.getTime() + eventDuration * 60 * 60 * 1000);
      const formatG = (d) => d.toISOString().replaceAll(/[-:]/g, '').split('.')[0] + 'Z';
      startStr = formatG(now);
      endStr = formatG(future);
    }
  
    var url = BASE_URL + encodeURIComponent(TITLE) + "&details=" + encodeURIComponent(TEXT) + "&location=" + encodeURIComponent(TWEET_URL) + "&dates=" + startStr + "%2F" + endStr;
    open(url, "_blank");
  }
}

/**
 * テキストから日付や時間を柔軟に解析し、Googleカレンダー形式の文字列ペアを返す
 */
function parseFlexibleDateTime(text, defaultDurationHours) {
  const currentYear = new Date().getFullYear();
  
  // 曜日表記「(金)」「（木）」や、全角スペースなどを標準化
  const cleanText = text.replace(/\([日月火水木金土]\)/g, ' ')
                        .replace(/（[日月火水木金土]）/g, ' ')
                        .replace(/\s+/g, ' ');

  // 1. 日付の抽出 (YYYY/MM/DD, MM/DD, MM月DD日 など)
  const dateRegex = /(([0-9]{4})[\/\.\-年])?([0-9]{1,2})[\/\.\-月]([0-9]{1,2})日?/g;
  let dates = [];
  let match;
  while ((match = dateRegex.exec(cleanText)) !== null) {
    let year = match[2] ? parseInt(match[2], 10) : currentYear;
    let month = parseInt(match[3], 10) - 1; // 0ベース化
    let day = parseInt(match[4], 10);
    dates.push({ year, month, day, index: match.index, raw: match[0] });
  }

  // 2. 時刻の抽出 (HH:MM)
  const timeRegex = /([0-9]{1,2}):([0-9]{2})/g;
  let times = [];
  while ((match = timeRegex.exec(cleanText)) !== null) {
    times.push({
      hour: parseInt(match[1], 10),
      minute: parseInt(match[2], 10),
      index: match.index,
      raw: match[0]
    });
  }

  // Googleカレンダー用のフォーマット関数
  // タイムゾーンによる日付ズレを防ぐため、端末のローカル時間ベースでISO（UTC）に変換
  const formatGoogleDate = (d) => d.toISOString().replaceAll(/[-:]/g, '').split('.')[0] + 'Z';
  const formatGoogleAllDay = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  };

  let candidates = [];

  // --- パターンA: 期間表現（〜 や -）があり、日付が2つ以上抽出されている場合 ---
  if (dates.length >= 2 && /[～~~\-ー〜]/.test(cleanText)) {
    // 期間内に「時刻指定」が特に含まれていない場合、終日イベントとして処理
    if (times.length === 0) {
      const d1 = new Date(dates[0].year, dates[0].month, dates[0].day);
      const d2 = new Date(dates[1].year, dates[1].month, dates[1].day);
      
      // Googleカレンダーの終日イベント仕様：終了日は「その日の翌日」を指定すると、その日まで枠が塗られる
      d2.setDate(d2.getDate() + 1);

      candidates.push({
        label: `【期間・終日】 ${dates[0].raw} ～ ${dates[1].raw}`,
        startStr: formatGoogleAllDay(d1),
        endStr: formatGoogleAllDay(d2)
      });
    }
  }

  // --- パターンB: 時刻をもとにした時間指定イベント候補の作成 ---
  if (times.length > 0) {
    times.forEach((t) => {
      // 最も適切な日付（時刻の直前に位置する日付）を探索
      let targetDate = dates[0] || { year: currentYear, month: new Date().getMonth(), day: new Date().getDate(), raw: "" };
      for (let d of dates) {
        if (d.index <= t.index) {
          targetDate = d;
        } else {
          break;
        }
      }

      const startIdx = Math.max(0, t.index - 12);
      const labelContext = cleanText.substring(startIdx, t.index).trim();

      const startDateObj = new Date(targetDate.year, targetDate.month, targetDate.day, t.hour, t.minute);
      const endDateObj = new Date(startDateObj.getTime() + defaultDurationHours * 60 * 60 * 1000);

      candidates.push({
        label: `【時間指定】 ${targetDate.raw ? targetDate.raw + ' ' : ''}${labelContext}${t.raw}`,
        startStr: formatGoogleDate(startDateObj),
        endStr: formatGoogleDate(endDateObj)
      });
    });
  }

  // --- パターンC: 日付はあるが時刻が一切ない単発の場合 ---
  if (dates.length > 0 && times.length === 0 && candidates.length === 0) {
    dates.forEach((d) => {
      const d1 = new Date(d.year, d.month, d.day);
      const d2 = new Date(d.year, d.month, d.day + 1);

      candidates.push({
        label: `【単発・終日】 ${d.raw}`,
        startStr: formatGoogleAllDay(d1),
        endStr: formatGoogleAllDay(d2)
      });
    });
  }

  return candidates;
}

// 展開処理
function tenkai(url) {
  return new Promise((resolve, reject) => {
    let req = new XMLHttpRequest();
    req.onreadystatechange = () => {
      switch (req.readyState) {
        case 4:
          let contentType = req.getResponseHeader("Content-Type");
          if (contentType === null) {
            resolve("展開できません");
          } else if (!/text\/html/.test(contentType)) {
            if (/image\//.test(contentType)) {
              resolve("画像です");
            } else if (/json/.test(contentType)) {
              resolve("JSONです");
            } else {
              resolve(contentType + " 形式のデータです");
            }
          } else if (req.status === 304 || req.status === 200) {
            var data = req.responseText;
            var result = data.match(/https?:\/\/[\w/:%#\$&\?\(\)~\.=\+\-]+/g)[0];
            resolve(result);
          } else {
            resolve("展開できません");
          }
          break;
        default:
          resolve(null);
      }
    };
    req.open('GET', url);
    req.send();
  });
}

openCal();