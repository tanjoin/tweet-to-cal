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
  
    // --- 2. 日時抽出および選択ダイアログ処理 ---
    let startDateObj = new Date(); // デフォルト
    let endDateObj = null;

    if (contentElem) {
      const rawText = contentElem.innerText;
      // テキストから日時候補をラベル（昼の部 開場など）付きで抽出
      const candidates = parseAllDateTimeCandidates(rawText);

      if (candidates.length > 0) {
        let selectedCandidate = candidates[0];

        // 候補が複数ある場合はダイアログを出して選択させる
        if (candidates.length > 1) {
          let promptMessage = "登録したい日時を選択してください（番号を入力）:\n";
          candidates.forEach((c, index) => {
            promptMessage += `${index + 1}: ${c.label} (${c.date.toLocaleString('ja-JP')})\n`;
          });
          
          const userInput = prompt(promptMessage, "1");
          if (userInput === null) {
            return; // キャンセルされた場合は処理を中断
          }
          const selectedIndex = parseInt(userInput, 10) - 1;
          if (selectedIndex >= 0 && selectedIndex < candidates.length) {
            selectedCandidate = candidates[selectedIndex];
          }
        }

        startDateObj = selectedCandidate.date;
      }
    }

    // 選択された開始時間から、設定されたeventDuration（時間）を足して終了時刻とする
    endDateObj = new Date(startDateObj.getTime());
    endDateObj.setHours(endDateObj.getHours() + Number(eventDuration));

    // Googleカレンダー用のフォーマット（YYYYMMDDTHHmmSSZ）に変換
    const formatGoogleDate = (date) => {
      return date.toISOString().replaceAll(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const startDateStr = formatGoogleDate(startDateObj);
    const endDateStr = formatGoogleDate(endDateObj);
  
    var url = BASE_URL + encodeURIComponent(TITLE) + "&details=" + encodeURIComponent(TEXT) + "&location=" + encodeURIComponent(TWEET_URL) + "&dates=" + startDateStr + "%2F" + endDateStr;
    open(url, "_blank");
  }
}

/**
 * テキストから「日付」と「時間」の組み合わせをすべて抽出し、
 * 直前にある文脈（昼の部、開場、開演など）をラベルにして返す関数
 */
function parseAllDateTimeCandidates(text) {
  const currentYear = new Date().getFullYear();
  
  // 曜日表記を消去
  const cleanText = text.replace(/\([日月火水木金土]\)/g, ' ');

  // 1. まずテキスト全体から「日付（月日）」の情報を探す
  // 例: 「5月16日」「05/16」
  const dateRegex = /([0-9]{4})[\/\.\-\s年]([0-9]{1,2})[\/\.\-\s月]([0-9]{1,2})日?|([0-9]{1,2})[\/\.\-\s月]([0-9]{1,2})日?/g;
  
  let dateMatches = [];
  let dateMatch;
  while ((dateMatch = dateRegex.exec(cleanText)) !== null) {
    let year = currentYear;
    let month, day;
    
    if (dateMatch[1]) { // 年がある場合
      year = parseInt(dateMatch[1], 10);
      month = parseInt(dateMatch[2], 10) - 1;
      day = parseInt(dateMatch[3], 10);
    } else { // 年がない場合
      month = parseInt(dateMatch[4], 10) - 1;
      day = parseInt(dateMatch[5], 10);
    }
    dateMatches.push({ year, month, day, index: dateMatch.index, text: dateMatch[0] });
  }

  // 日付が1つも見つからない場合は空で返す
  if (dateMatches.length === 0) return [];

  // 2. 「時刻（HH:MM）」を探す
  // 直前20文字程度を切り取って「昼の部 開場」などのラベルにする
  const timeRegex = /([0-9]{1,2}):([0-9]{2})/g;
  let candidates = [];
  let timeMatch;

  while ((timeMatch = timeRegex.exec(cleanText)) !== null) {
    const hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2], 10);

    // この時刻の直前にあるテキストをラベルとして抽出（最大15文字）
    const startIdx = Math.max(0, timeMatch.index - 15);
    const labelContext = cleanText.substring(startIdx, timeMatch.index).trim().replace(/\s+/g, ' ');

    // 最も近い位置にある（基本的には直前にある）日付を紐付ける
    let targetDate = dateMatches[0];
    for (let d of dateMatches) {
      if (d.index <= timeMatch.index) {
        targetDate = d;
      } else {
        break;
      }
    }

    const parsedDate = new Date(targetDate.year, targetDate.month, targetDate.day, hour, minute);
    if (!isNaN(parsedDate.getTime())) {
      candidates.push({
        date: parsedDate,
        label: labelContext || "時刻"
      });
    }
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