// デフォルト値
const DEFAULT_EVENT_DURATION = 2;

// 設定を読み込む
function loadOptions() {
  chrome.storage.sync.get({
    eventDuration: DEFAULT_EVENT_DURATION
  }, function(items) {
    document.getElementById('eventDuration').value = items.eventDuration;
  });
}

// 設定を保存する
function saveOptions() {
  const eventDuration = parseFloat(document.getElementById('eventDuration').value);
  
  chrome.storage.sync.set({
    eventDuration: eventDuration
  }, function() {
    // 保存完了メッセージを表示
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.textContent = '設定を保存しました';
    statusMessage.className = 'status-message success show';
    
    // 3秒後にメッセージを非表示
    setTimeout(function() {
      statusMessage.classList.remove('show');
    }, 3000);
  });
}

// ページ読み込み時に設定を読み込む
document.addEventListener('DOMContentLoaded', loadOptions);

// 保存ボタンのクリックイベント
document.getElementById('saveButton').addEventListener('click', saveOptions);
