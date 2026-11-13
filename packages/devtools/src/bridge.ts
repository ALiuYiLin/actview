// ============================================================
// @actview/devtools — 页面 ↔ 浏览器扩展 bridge
//
// 协议：
//   page     → content : source = 'actview-devtools-page'
//   content  → page    : source = 'actview-devtools-content'
//   panel    → content : chrome.tabs.sendMessage({ source:'actview-devtools-panel' })
//
// 页面侧只依赖 backend，不依赖扩展。
// ============================================================

import type { DevtoolsBackend } from './backend'
import { serializeState, serializeValue } from './serialize'

const PAGE_SOURCE = 'actview-devtools-page'
const CONTENT_SOURCE = 'actview-devtools-content'
const HIGHLIGHT_ID = '__actview_devtools_highlight__'

let activeBridge: (() => void) | null = null

export interface DevtoolsBridgeOptions {
  /** 关闭页面侧 bridge（默认开启） */
  enabled?: boolean
}

/** 启动页面侧 bridge（单例）；由 devtoolsPlugin 调用。 */
export function startDevtoolsBridge(
  backend: DevtoolsBackend,
  options: DevtoolsBridgeOptions = {},
): () => void {
  if (options.enabled === false || typeof window === 'undefined') {
    return () => {}
  }
  if (activeBridge) return activeBridge

  let scheduled = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let overlay: HTMLElement | null = null
  let pickerActive = false

  const post = (type: string, payload?: unknown): void => {
    window.postMessage({ source: PAGE_SOURCE, type, payload }, '*')
  }

  const sendSnapshot = (): void => {
    const snapshot = backend.getSnapshot()
    post('snapshot', {
      apps: snapshot.apps,
      components: snapshot.components.map((component) => ({
        ...component,
        el: undefined,
        elTag: component.el?.tagName?.toLowerCase() ?? null,
        elId: component.el?.id || null,
      })),
      events: snapshot.events.map((event) => ({
        seq: event.seq,
        type: event.type,
        timestamp: event.timestamp,
        appId: event.appId,
        componentId: event.componentId,
        name: event.name,
        payload: event.payload
          ? {
              ...event.payload,
              target: undefined,
              newValue:
                event.payload.newValue !== undefined
                  ? serializeValue(event.payload.newValue, 2)
                  : undefined,
              oldValue:
                event.payload.oldValue !== undefined
                  ? serializeValue(event.payload.oldValue, 2)
                  : undefined,
            }
          : undefined,
      })),
      performance: snapshot.performance,
    })
  }

  const scheduleSnapshot = (): void => {
    if (scheduled) return
    scheduled = true
    timer = setTimeout(() => {
      scheduled = false
      timer = null
      sendSnapshot()
    }, 16)
  }

  const ensureOverlay = (): HTMLElement => {
    if (overlay?.isConnected) return overlay
    overlay = document.createElement('div')
    overlay.id = HIGHLIGHT_ID
    Object.assign(overlay.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '2147483646',
      border: '2px solid #42b883',
      background: 'rgba(66, 184, 131, 0.16)',
      borderRadius: '2px',
      transition: 'all 80ms ease',
    })
    document.documentElement.appendChild(overlay)
    return overlay
  }

  const highlightElement = (element: Element | null): void => {
    if (!element) {
      clearHighlight()
      return
    }
    const rect = element.getBoundingClientRect()
    const box = ensureOverlay()
    Object.assign(box.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    })
  }

  const clearHighlight = (): void => {
    overlay?.remove()
    overlay = null
  }

  const highlightComponent = (id: number): void => {
    highlightElement(backend.getComponentElement(id))
  }

  const stopPicker = (): void => {
    pickerActive = false
    document.removeEventListener('mousemove', onPickerMove, true)
    document.removeEventListener('click', onPickerClick, true)
    document.removeEventListener('keydown', onPickerKey, true)
    clearHighlight()
  }

  const onPickerMove = (event: MouseEvent): void => {
    if (!pickerActive) return
    const target = event.target as Element | null
    if (target) highlightElement(target)
  }

  const onPickerClick = (event: MouseEvent): void => {
    if (!pickerActive) return
    event.preventDefault()
    event.stopPropagation()
    const target = event.target as Element | null
    const id = target ? backend.findComponentByElement(target) : null
    stopPicker()
    if (id != null) {
      highlightComponent(id)
      post('picked', { id })
    } else {
      post('picker-empty')
    }
  }

  const onPickerKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      stopPicker()
      post('picker-cancelled')
    }
  }

  const startPicker = (): void => {
    if (pickerActive) return
    pickerActive = true
    document.addEventListener('mousemove', onPickerMove, true)
    document.addEventListener('click', onPickerClick, true)
    document.addEventListener('keydown', onPickerKey, true)
    post('picker-started')
  }

  const onMessage = (event: MessageEvent): void => {
    if (event.source !== window) return
    const data = event.data as { source?: string; type?: string; payload?: any }
    if (!data || data.source !== CONTENT_SOURCE) return

    switch (data.type) {
      case 'connect':
        sendSnapshot()
        break
      case 'refresh':
        sendSnapshot()
        break
      case 'getState': {
        const id = Number(data.payload?.id)
        const state = backend.getComponentState(id)
        post('state', {
          id,
          state: state
            ? {
                id: state.id,
                appId: state.appId,
                name: state.name,
                props: serializeState(state.props),
                state: serializeState(state.state),
                computed: serializeState(state.computed),
                models: state.models.map((model) => ({
                  token: model.token,
                  state: serializeState(model.state),
                  computed: serializeState(model.computed),
                })),
              }
            : null,
        })
        break
      }
      case 'highlight': {
        const id = Number(data.payload?.id)
        if (Number.isFinite(id)) highlightComponent(id)
        break
      }
      case 'clearHighlight':
        clearHighlight()
        break
      case 'startPicker':
        startPicker()
        break
      case 'stopPicker':
        stopPicker()
        break
    }
  }

  const unsubscribe = backend.subscribe(() => {
    scheduleSnapshot()
  })
  window.addEventListener('message', onMessage)
  // 页面插件晚于 content script 启动时，主动广播一次。
  sendSnapshot()

  activeBridge = () => {
    unsubscribe()
    window.removeEventListener('message', onMessage)
    if (timer) clearTimeout(timer)
    stopPicker()
    clearHighlight()
    activeBridge = null
  }
  return activeBridge
}

/** 停止 bridge（测试 / HMR 用） */
export function stopDevtoolsBridge(): void {
  activeBridge?.()
}
