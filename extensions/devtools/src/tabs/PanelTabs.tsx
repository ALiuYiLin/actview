// ============================================================
// Tabs 导航
// ============================================================

import { ActViewComponent, Component, Prop } from 'actview'
import type { PanelTab } from '../types'

@Component({ name: 'PanelTabs' })
export class PanelTabs extends ActViewComponent {
  @Prop
  tab: PanelTab = 'components'

  @Prop
  paused = false

  @Prop
  onSwitch: (tab: PanelTab) => void = () => {}

  @Prop
  onTogglePause: () => void = () => {}

  render() {
    return (
      <nav class="tabs">
        <button
          data-tab="components"
          class={`tab${this.tab === 'components' ? ' active' : ''}`}
          onClick={() => this.onSwitch('components')}
        >
          Components
        </button>
        <button
          data-tab="events"
          class={`tab${this.tab === 'events' ? ' active' : ''}`}
          onClick={() => this.onSwitch('events')}
        >
          Events
        </button>
        <button
          data-tab="performance"
          class={`tab${this.tab === 'performance' ? ' active' : ''}`}
          onClick={() => this.onSwitch('performance')}
        >
          Performance
        </button>
        <button class="tab right" onClick={this.onTogglePause}>
          {this.paused ? 'Resume events' : 'Pause events'}
        </button>
      </nav>
    )
  }
}
