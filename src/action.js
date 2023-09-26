async function openCal() {
  const BASE_URL = "https://www.google.com/calendar/render?action=TEMPLATE&text=";
  const NL = "\n";
  const SELECTOR_CONTENT = 'article > div > div > div:nth-child(3) > div:nth-child(1)';
  
  let TITLE = "予定あり";
  if (document.querySelector(SELECTOR_CONTENT)) {
    TITLE = document.querySelector(SELECTOR_CONTENT).innerText.split('\n').shift();
  }

  let TEXT = "";
  if (document.querySelector(SELECTOR_CONTENT) && 
      !document.querySelector(SELECTOR_CONTENT).innerText.includes('返信先')) {
    TEXT = document.querySelector(SELECTOR_CONTENT).innerText + NL;
    let urls = [...document.querySelectorAll(`${SELECTOR_CONTENT} a`)].map((a) => a.href).filter((url) => !url.includes('hashtag'));
    let expandedUrls = [];
    for (let i = 0; i < urls.length; i++) {
      let expandedUrl = await tenkai(urls[i]);
      if (expandedUrl) {
        urls[i] = expandedUrl;
      }      
    }
    TEXT += NL + urls.join(NL) + NL + expandedUrls.join(NL) + NL;
  }

  const TWEET_URL = window.location.href;
  
  const DATE = new Date().toISOString().replaceAll(/[/.:-]/g, '');
  let startDate = DATE;
  let endDate = DATE;
  let contentDates = document.querySelector(SELECTOR_CONTENT).innerHTML
                    .replace(/\(日\)/g, ' ')
                    .replace(/\(月\)/g, ' ')
                    .replace(/\(火\)/g, ' ')
                    .replace(/\(水\)/g, ' ')
                    .replace(/\(木\)/g, ' ')
                    .replace(/\(金\)/g, ' ')
                    .replace(/\(土\)/g, ' ')
                    .replace(/年/g, '/')
                    .replace(/月/g, '/')
                    .replace(/日/g, ' ')
                    .match(/(([0-9]+)?\/?([0-9]+)\/([0-9]+) +([0-9]+):([0-9]+))/g);
  if (contentDates.length >= 2) {
    if (contentDates[0].split('/').length === 2) {
      contentDates[0] = new Date().getFullYear() + "/" + contentDates[0];
    }
    if (contentDates[1].split('/').length === 2) {
      contentDates[1] = new Date().getFullYear() + "/" + contentDates[1];
    }
    startDate = new Date(contentDates[0]).toISOString().replaceAll(/[/.:-]/g, '');
    endDate   = new Date(contentDates[1]).toISOString().replaceAll(/[/.:-]/g, '');
  }

  var url = BASE_URL + encodeURIComponent(TITLE) + "&details=" + encodeURIComponent(TEXT) + "&location=" + encodeURIComponent(TWEET_URL) + "&dates=" + startDate + "%2F" + endDate;
  open(url, "_blank");
}

function isStatusPage() {
  return /.*:\/\/twitter.com\/.*\/status\/.*/.test(window.location.href);
}

if (isStatusPage()) {
  openCal();
}

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
      }
    };
    req.open('GET', url);
    req.send();
  });
}