// ============================================================
// ActView DevTools 扩展面板（用 ActView 自己实现）
// ============================================================

import {
  ActViewComponent,
  Component,
  Ref,
  Setup,
  Unmounted,
  createApp,
} from 'actview'

declare const chrome: any

const PAGE_SOURCE = 'actview-devtools-page'
const PANEL_SOURCE = 'actview-devtools-panel'

interface ComponentRecord {
  id: number
  appId: number
  name: string
  parentId: number | null
  childIds: number[]
  renderCount: number
  elTag: string | null
  elId: string | null
}

interface AppRecord {
  id: number
  name: string
  rootId: number | null
}

interface EventRecord {
  seq: number
  type: string
  timestamp: number
  appId: number
  componentId?: number
  name?: string
  payload?: { key?: unknown; keyType?: string }
}

interface PerformanceRecord {
  appId: number
  componentId: number
  name: string
  kind: string
  duration: number
  renderCount: number
  timestamp: number
}

interface StateSnapshot {
  id: number
  appId: number
  name: string
  props: Record<string, unknown>
  state: Record<string, unknown>
  computed: Record<string, unknown>
  models: Array<{
    token: string
    state: Record<string, unknown>
    computed: Record<string, unknown>
  }>
}

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
  tab: 'components' | 'events' | 'performance' = 'components'

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
          this.setConnected(false)
        }
      },
    )
  }

  private setConnected(connected: boolean): void {
    this.connected = connected
    if (!connected) this.contentReady = false
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

  private selectComponent(id: number): void {
    this.selectedId = id
    this.selectedState = null
    this.requestState()
    this.send('highlight', { id })
  }

  private visibleComponents(): ComponentRecord[] {
    if (this.appId == null) return []
    return this.components.filter((component) => component.appId === this.appId)
  }

  private renderTree() {
    const components = this.visibleComponents()
    if (components.length === 0) {
      return (
        <div class="tree-empty">
          {this.connected ? 'No components captured.' : 'Waiting for @actview/devtools…'}
        </div>
      )
    }

    const ids = new Set(components.map((component) => component.id))
    const roots = components.filter(
      (component) =>
        component.parentId == null || !ids.has(component.parentId),
    )
    const rendered = new Set<number>()

    const walk = (component: ComponentRecord, depth: number): any[] => {
      if (rendered.has(component.id)) return []
      rendered.add(component.id)
      const children = components.filter(
        (child) => child.parentId === component.id,
      )
      const row = (
        <div
          key={component.id}
          class={`tree-node${component.id === this.selectedId ? ' selected' : ''}`}
          style={{ paddingLeft: `${10 + depth * 14}px` }}
          onClick={() => this.selectComponent(component.id)}
        >
          <span class="caret">{children.length > 0 ? '▾' : '·'}</span>
          <span class="name">{component.name || 'Anonymous'}</span>
          <span class="badge" title="render count">
            {component.renderCount ?? 0}
          </span>
        </div>
      )
      return [row, ...children.flatMap((child) => walk(child, depth + 1))]
    }

    return roots.flatMap((root) => walk(root, 0))
  }

  private renderDetails() {
    const component = this.components.find(
      (item) => item.id === this.selectedId,
    )
    if (!component) {
      return <div class="details empty">Select a component from the tree.</div>
    }

    const data = this.selectedState
    return (
      <div class="details">
        <h2>{component.name || 'Anonymous'}</h2>
        <div class="meta">
          id {component.id} · app {component.appId} · renders{' '}
          {component.renderCount} · {component.elTag || 'no host'}
          {component.elId ? `#${component.elId}` : ''}
        </div>
        {!data ? (
          <div class="panel-hint">Loading state…</div>
        ) : (
          <>
            {this.renderValueSection('Props', data.props)}
            {this.renderValueSection('State', data.state)}
            {this.renderValueSection('Computed', data.computed)}
            <div class="section-title">
              Models ({data.models?.length ?? 0})
            </div>
            {!data.models || data.models.length === 0 ? (
              <div class="panel-hint">No @Model in this component.</div>
            ) : (
              data.models.map((model) => (
                <div class="model" key={model.token}>
                  <div class="model-head">{model.token}</div>
                  <pre class="value">
                    {formatValue({
                      state: model.state,
                      computed: model.computed,
                    })}
                  </pre>
                </div>
              ))
            )}
          </>
        )}
      </div>
    )
  }

  private renderValueSection(title: string, value: unknown) {
    return (
      <>
        <div class="section-title">{title}</div>
        <pre class="value">{formatValue(value)}</pre>
      </>
    )
  }

  private renderEvents() {
    const events = this.events.slice(-200).reverse()
    if (events.length === 0) {
      return <div class="tree-empty">No events yet.</div>
    }
    return (
      <table>
        <thead>
          <tr>
            <th>time</th>
            <th>type</th>
            <th>component</th>
            <th>key</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.seq}>
              <td>{new Date(event.timestamp).toLocaleTimeString()}</td>
              <td class={`event-${event.type}`}>{event.type}</td>
              <td>
                {event.name ||
                  (event.componentId != null ? `#${event.componentId}` : '—')}
              </td>
              <td>
                {event.payload?.key == null
                  ? '—'
                  : String(event.payload.key)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  private renderPerformance() {
    const records = this.performance
      .slice()
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 200)
    if (records.length === 0) {
      return (
        <div class="tree-empty">
          No performance records. Set app.config.performance = true.
        </div>
      )
    }
    return (
      <table>
        <thead>
          <tr>
            <th>component</th>
            <th>kind</th>
            <th>duration</th>
            <th>renders</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={`${record.componentId}-${record.timestamp}`}>
              <td>{record.name || `#${record.componentId}`}</td>
              <td>{record.kind}</td>
              <td>{record.duration.toFixed(2)} ms</td>
              <td>{record.renderCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  private statusText(): string {
    if (this.statusHint) return this.statusHint
    if (this.connected) return 'connected'
    if (this.contentReady)
      return 'extension injected; waiting for @actview/devtools'
    return 'no content script; reload the extension and page'
  }

  private statusClass(): string {
    if (this.connected) return 'status connected'
    if (this.contentReady) return 'status'
    return 'status disconnected'
  }

  private handleAppChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value)
    this.appId = Number.isFinite(value) ? value : null
    this.selectedId = null
    this.selectedState = null
    this.send('clearHighlight')
  }

  render() {
    return (
      <div class="app-shell">
        <header class="topbar">
          <div class="brand">
            ActView <span>DevTools</span>
          </div>
          <div class={this.statusClass()}>{this.statusText()}</div>
          <div class="topbar-actions">
            <select
              title="Application"
              value={this.appId == null ? '' : String(this.appId)}
              onChange={(event: Event) => this.handleAppChange(event)}
            >
              {this.apps.length === 0 ? (
                <option value="">no app</option>
              ) : (
                this.apps.map((app) => (
                  <option value={String(app.id)}>{app.name || `App ${app.id}`}</option>
                ))
              )}
            </select>
            <button class="btn" onClick={() => this.send('refresh')}>
              Refresh
            </button>
            <button class="btn" onClick={() => this.send('startPicker')}>
              Pick element
            </button>
          </div>
        </header>

        <div class="layout">
          <aside class="sidebar">
            <div class="sidebar-title">
              Components
              <button
                class="link"
                onClick={() => this.send('clearHighlight')}
              >
                clear highlight
              </button>
            </div>
            <div class="tree">{this.renderTree()}</div>
          </aside>

          <main class="main">
            <nav class="tabs">
              <button
                data-tab="components"
                class={`tab${this.tab === 'components' ? ' active' : ''}`}
                onClick={() => (this.tab = 'components')}
              >
                Components
              </button>
              <button
                data-tab="events"
                class={`tab${this.tab === 'events' ? ' active' : ''}`}
                onClick={() => (this.tab = 'events')}
              >
                Events
              </button>
              <button
                data-tab="performance"
                class={`tab${this.tab === 'performance' ? ' active' : ''}`}
                onClick={() => (this.tab = 'performance')}
              >
                Performance
              </button>
              <button
                class="tab right"
                onClick={() => (this.paused = !this.paused)}
              >
                {this.paused ? 'Resume events' : 'Pause events'}
              </button>
            </nav>

            {this.tab === 'components' ? (
              <section class="tab-panel">
                {this.selectedId == null ? (
                  <div class="details empty">
                    Select a component from the tree.
                  </div>
                ) : (
                  this.renderDetails()
                )}
              </section>
            ) : null}

            {this.tab === 'events' ? (
              <section class="tab-panel">
                <div class="panel-hint">
                  Recent mount / update / track / trigger events.
                </div>
                <div class="table-wrap">{this.renderEvents()}</div>
              </section>
            ) : null}

            {this.tab === 'performance' ? (
              <section class="tab-panel">
                <div class="panel-hint">
                  Render duration (mount / update).
                </div>
                <div class="table-wrap">{this.renderPerformance()}</div>
              </section>
            ) : null}
          </main>
        </div>
      </div>
    )
  }
}

function formatValue(value: unknown): string {
  if (value === undefined) return 'undefined'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

createApp(DevtoolsPanel).mount('#app')
