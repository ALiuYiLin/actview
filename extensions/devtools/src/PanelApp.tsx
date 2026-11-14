// ============================================================
// DevTools panel 根组件：chrome bridge + 状态编排
// ============================================================

import {
  ActViewComponent,
  Component,
  Ref,
  Setup,
  Unmounted,
} from 'actview'
import { PanelContent } from './layout/PanelContent'
import { PanelHead } from './layout/PanelHead'
import { PanelSidebar } from './layout/PanelSidebar'
import type {
  AppRecord,
  ComponentRecord,
  EventRecord,
  PanelTab,
  PerformanceRecord,
  StateSnapshot,
} from './types'

declare const chrome: any

const PAGE_SOURCE = 'actview-devtools-page'
const PANEL_SOURCE = 'actview-devtools-panel'

@Component({ name: 'DevtoolsPanel' })
export class DevtoolsPanel extends ActViewComponent {
  @Ref
  connected = false

  @Ref
  contentReady = false

  @Ref
  statusHint = ''

  @Ref
  apps: AppRecord[] = []

  @Ref
  components: ComponentRecord[] = []

  @Ref
  events: EventRecord[] = []

  @Ref
  performance: PerformanceRecord[] = []

  @Ref
  appId: number | null = null

  @Ref
  selectedId: number | null = null

  @Ref
  selectedState: StateSnapshot | null = null

  @Ref
  tab: PanelTab = 'components'

  @Ref
  paused = false

  private readonly tabId = chrome.devtools.inspectedWindow.tabId
  private reconnectTimer: ReturnType<typeof setInterval> | null = null

  private readonly onRuntimeMessage = (message: any, sender: any): void => {
    if (!message || message.source !== PAGE_SOURCE) return
    if (sender.tab && sender.tab.id !== this.tabId) return

    switch (message.type) {
      case 'content-ready':
        this.contentReady = true
        this.statusHint = ''
        break
      case 'snapshot':
        this.applySnapshot(message.payload || {})
        break
      case 'state':
        if (message.payload?.id === this.selectedId) {
          this.selectedState = message.payload.state
        }
        break
      case 'picked':
        if (message.payload?.id != null) {
          this.connected = true
          this.selectedId = message.payload.id
          this.selectedState = null
          this.tab = 'components'
          this.requestState()
        }
        break
      case 'picker-started':
        this.statusHint = 'pick an element (Esc to cancel)'
        break
      case 'picker-empty':
        this.statusHint = 'no ActView component found'
        break
      case 'picker-cancelled':
        this.statusHint = ''
        break
    }
  }

  private readonly onBeforeUnload = (): void => {
    this.send('clearHighlight')
    this.send('stopPicker')
  }

  @Setup
  setup(): void {
    chrome.runtime.onMessage.addListener(this.onRuntimeMessage)
    window.addEventListener('beforeunload', this.onBeforeUnload)
    this.send('connect')
    this.reconnectTimer = setInterval(() => {
      if (!this.connected) this.send('connect')
    }, 2000)
  }

  @Unmounted
  unmounted(): void {
    chrome.runtime.onMessage.removeListener(this.onRuntimeMessage)
    window.removeEventListener('beforeunload', this.onBeforeUnload)
    if (this.reconnectTimer) clearInterval(this.reconnectTimer)
    this.reconnectTimer = null
  }

  private send(type: string, payload?: unknown): void {
    chrome.tabs.sendMessage(
      this.tabId,
      { source: PANEL_SOURCE, type, payload },
      () => {
        if (chrome.runtime.lastError) {
          this.connected = false
          this.contentReady = false
        }
      },
    )
  }

  private applySnapshot(payload: any): void {
    this.connected = true
    this.contentReady = true
    this.statusHint = ''
    this.apps = Array.isArray(payload.apps) ? payload.apps : []
    this.components = Array.isArray(payload.components)
      ? payload.components
      : []
    this.performance = Array.isArray(payload.performance)
      ? payload.performance
      : []
    if (!this.paused) {
      this.events = Array.isArray(payload.events) ? payload.events : []
    }

    if (this.appId == null && this.apps.length > 0) {
      this.appId = this.apps[0].id
    }
    if (this.appId != null && !this.apps.some((app) => app.id === this.appId)) {
      this.appId = this.apps[0]?.id ?? null
    }
    if (
      this.selectedId != null &&
      !this.components.some((component) => component.id === this.selectedId)
    ) {
      this.selectedId = null
      this.selectedState = null
      this.send('clearHighlight')
    }
    if (this.selectedId != null) this.requestState()
  }

  private requestState(): void {
    if (this.selectedId == null) return
    this.send('getState', { id: this.selectedId })
  }

  private handleAppChange(id: number | null): void {
    this.appId = id
    this.selectedId = null
    this.selectedState = null
    this.send('clearHighlight')
  }

  private handleSelect(id: number): void {
    this.selectedId = id
    this.selectedState = null
    this.tab = 'components'
    this.requestState()
    this.send('highlight', { id })
  }

  render() {
    const component = this.components.find(
      (item) => item.id === this.selectedId,
    )
    return (
      <div class="app-shell">
        <PanelHead
          apps={this.apps}
          appId={this.appId}
          connected={this.connected}
          contentReady={this.contentReady}
          statusHint={this.statusHint}
          onAppChange={(id: number | null) => this.handleAppChange(id)}
          onRefresh={() => this.send('refresh')}
          onPick={() => this.send('startPicker')}
        />
        <div class="layout">
          <PanelSidebar
            components={this.components}
            appId={this.appId}
            selectedId={this.selectedId}
            connected={this.connected}
            onComponentSelect={(id: number) => this.handleSelect(id)}
            onClearHighlight={() => this.send('clearHighlight')}
          />
          <PanelContent
            tab={this.tab}
            paused={this.paused}
            events={this.events}
            performance={this.performance}
            component={component ?? null}
            state={this.selectedState}
            onSwitch={(tab: PanelTab) => (this.tab = tab)}
            onTogglePause={() => (this.paused = !this.paused)}
          />
        </div>
      </div>
    )
  }
}
