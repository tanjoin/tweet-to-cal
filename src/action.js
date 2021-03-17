function openCal() {
  const BASE_URL = "https://www.google.com/calendar/render?action=TEMPLATE&text=%E4%BA%88%E5%AE%9A%E3%81%82%E3%82%8A&details=";
  const NL = "\n";
  let TEXT = "";
  if (document.querySelector('article > div > div > div > div:nth-child(3) > div:nth-child(1)') && !document.querySelector('article > div > div > div > div:nth-child(3) > div:nth-child(1)').innerText.includes('返信先')) {
    TEXT = document.querySelector('article > div > div > div > div:nth-child(3) > div:nth-child(1)').innerText + NL;
    TEXT += [...document.querySelectorAll('article > div > div > div > div:nth-child(3) > div:nth-child(1) a')].map((a) => a.href).filter((url) => !url.includes('hashtag')).join(NL) + NL;
  }
  if (document.querySelector('article > div > div > div > div:nth-child(3) > div:nth-child(2)')) {
    TEXT += document.querySelector('article > div > div > div > div:nth-child(3) > div:nth-child(2)').innerText + NL;
    TEXT += [...document.querySelectorAll('article > div > div > div > div:nth-child(3) > div:nth-child(1) a')].map((a) => a.href).filter((url) => !url.includes('hashtag')).join(NL) + NL;
  }
  let LINK = "";
  if (document.querySelector('article > div > div > div > div link')) {
    LINK = document.querySelector('article > div > div > div > div link').href;
  }
  const TWEET_URL = window.location.href;
  const DATE = new Date().toISOString().replaceAll(/[/.:-]/g, '');
  var url = BASE_URL + encodeURIComponent(TEXT + NL + LINK) + "&location=" + encodeURIComponent(TWEET_URL) + "&dates=" + DATE + "%2F" + DATE;
  open(url, "_blank");
}

function isStatusPage() {
  return /.*:\/\/twitter.com\/.*\/status\/.*/.test(window.location.href);
}

if (isStatusPage()) {
  openCal();
}

