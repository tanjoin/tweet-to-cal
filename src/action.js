async function openCal() {
  if (/.*:\/\/(twitter|x).com\/.*\/status\/.*/.test(window.location.href)) {
    const BASE_URL = "https://www.google.com/calendar/render?action=TEMPLATE&text=";
    const NL = "\n";
    const SELECTOR_CONTENT = 'article > div > div > div:nth-child(3) > div:nth-child(1)';
    const DEFAULT_EVENT_DURATION = 2;

    // 1. chrome.storage から設定を取得（なければデフォルト値）
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
  
    // --- 2. 日時抽出・パース処理の刷新 ---
    let startDateObj = new Date(); // デフォルトは現在時刻
    let endDateObj = null;

    if (contentElem) {
      const rawText = contentElem.innerText;
      const dates = parseDatesFromText(rawText);

      if (dates.length >= 1) {
        startDateObj = dates[0];
        if (dates.length >= 2) {
          endDateObj = dates[1];
        }
      }
    }

    // 終了時刻がない場合、設定されたeventDuration（時間）を足す
    if (!endDateObj) {
      endDateObj = new Date(startDateObj.getTime());
      endDateObj.setHours(endDateObj.getHours() + Number(eventDuration));
    }

    // Googleカレンダー用のフォーマット（YYYYMMDDTHHmmSSZ）に変換する関数
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
 * テキストから日時を高度に抽出する関数
 * 「2026/06/07 15:00」「12月25日 19:30」「06-07 12:00」などの表記に対応
 */
function parseDatesFromText(text) {
  const currentYear = new Date().getFullYear();
  // 曜日表記（(月), (text)など）をあらかじめ一掃
  const cleanText = text.replace(/\([日月火水木金土]\)/g, ' ');

  // 様々な日時パターンにマッチする正規表現
  // 例: 2026/06/07 12:00, 6月7日 12:00, 06-07 12:00 など
  const dateTimeRegex = /(([0-9]{4})[\/\.\-\s年])?([0-9]{1,2})[\/\.\-\s月]([0-9]{1,2})[日\s]+([0-9]{1,2}):([0-9]{2})/g;
  
  let matches = [];
  let match;
  
  while ((match = dateTimeRegex.exec(cleanText)) !== null) {
    let year = match[2] ? parseInt(match[2], 10) : currentYear;
    let month = parseInt(match[3], 10) - 1; // Date型は0始まり
    let day = parseInt(match[4], 10);
    let hour = parseInt(match[5], 10);
    let minute = parseInt(match[6], 10);

    const parsedDate = new Date(year, month, day, hour, minute);
    if (!isNaN(parsedDate.getTime())) {
      matches.push(parsedDate);
    }
  }
  return matches;
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