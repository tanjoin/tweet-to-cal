function switchIconStatus(url) {
  if (isStatusPage(url)) {
    chrome.action.enable();
    chrome.action.setIcon({path: "img/16.png"});
  } else {
    chrome.action.disable();
    chrome.action.setIcon({path: "img/16-disabled.png"});
  }
}

function isStatusPage(url) {
  return /.*:\/\/twitter.com\/.*\/status\/.*/.test(url);
}

chrome.action.onClicked.addListener((activeTab) => {
  chrome.scripting.executeScript({
    target: { tabId: activeTab.id },
    files: ['action.js']
  });
});
 
chrome.tabs.onUpdated.addListener((tabId, cinfo, tab) => {
  switchIconStatus(tab.url);
});
