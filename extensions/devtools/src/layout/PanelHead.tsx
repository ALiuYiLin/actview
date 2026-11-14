// ============================================================
// 顶部栏：连接状态 / App 选择 / 全局操作
// ============================================================

import { ActViewComponent, Component, Prop } from 'actview'
import type { AppRecord } from '../types'

@Component({ name: 'PanelHead' })
export class PanelHead extends ActViewComponent {
  @Prop
  apps: AppRecord[] = []

  @Prop
  appId: number | null = null

  @Prop
  connected = false

  @Prop
  contentReady = false

  @Prop
  statusHint = ''

  @Prop
  onAppChange: (id: number | null) => void = () => {}

  @Prop
  onRefresh: () => void = () => {}

  @Prop
  onPick: () => void = () => {}

  render() {
    return (
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
                <option key={app.id} value={String(app.id)}>
                  {app.name || `App ${app.id}`}
                </option>
              ))
            )}
          </select>
          <button class="btn" onClick={this.onRefresh}>
            Refresh
          </button>
          <button class="btn" onClick={this.onPick}>
            Pick element
          </button>
        </div>
      </header>
    )
  }

  private handleAppChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value)
    this.onAppChange(Number.isFinite(value) ? value : null)
  }

  private statusText(): string {
    if (this.statusHint) return this.statusHint
    if (this.connected) return 'connected'
    if (this.contentReady) {
      return 'extension injected; waiting for @actview/devtools'
    }
    return 'no content script; reload the extension and page'
  }

  private statusClass(): string {
    if (this.connected) return 'status connected'
    if (this.contentReady) return 'status'
    return 'status disconnected'
  }
}
