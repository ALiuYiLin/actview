// ============================================================
// 主内容：Tabs + 当前 Tab
// ============================================================

import { ActViewComponent, Component, Prop } from 'actview'
import { ComponentsTab } from '../tabs/ComponentsTab'
import { EventsTab } from '../tabs/EventsTab'
import { PanelTabs } from '../tabs/PanelTabs'
import { PerformanceTab } from '../tabs/PerformanceTab'
import type {
  ComponentRecord,
  EventRecord,
  PanelTab,
  PerformanceRecord,
  StateSnapshot,
} from '../types'

@Component({ name: 'PanelContent' })
export class PanelContent extends ActViewComponent {
  @Prop
  tab: PanelTab = 'components'

  @Prop
  paused = false

  @Prop
  events: EventRecord[] = []

  @Prop
  performance: PerformanceRecord[] = []

  @Prop
  component: ComponentRecord | null = null

  @Prop
  state: StateSnapshot | null = null

  @Prop
  onSwitch: (tab: PanelTab) => void = () => {}

  @Prop
  onTogglePause: () => void = () => {}

  render() {
    return (
      <main class="main">
        <PanelTabs
          tab={this.tab}
          paused={this.paused}
          onSwitch={this.onSwitch}
          onTogglePause={this.onTogglePause}
        />
        {this.tab === 'components' ? (
          <ComponentsTab component={this.component} state={this.state} />
        ) : null}
        {this.tab === 'events' ? (
          <EventsTab events={this.events} />
        ) : null}
        {this.tab === 'performance' ? (
          <PerformanceTab records={this.performance} />
        ) : null}
      </main>
    )
  }
}
