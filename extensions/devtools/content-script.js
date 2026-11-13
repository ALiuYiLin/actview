// 页面 ↔ 扩展 content script bridge。
// 页面侧由 @actview/devtools 的 startDevtoolsBridge 提供。

const PAGE_SOURCE = 'actview-devtools-page'
const CONTENT_SOURCE = 'actview-devtools-content'
const PANEL_SOURCE = 'actview-devtools-panel'

function sendToExtension(message) {
  try {
    chrome.runtime.sendMessage(message, () => {
      // 扩展上下文失效时忽略；panel 未打开时也可能没有接收方。
      void chrome.runtime.lastError
    })
  } catch {
    // ignore
  }
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return
  const data = event.data
  if (!data || data.source !== PAGE_SOURCE) return
  sendToExtension({
    source: PAGE_SOURCE,
    type: data.type,
    payload: data.payload,
  })
})

chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.source !== PANEL_SOURCE) return
  window.postMessage(
    {
      source: CONTENT_SOURCE,
      type: message.type,
      payload: message.payload,
    },
    '*',
  )
})

// 页面 bridge 可能晚于 content script 启动；panel 连接时会再次触发。
window.postMessage({ source: CONTENT_SOURCE, type: 'hello' }, '*')
