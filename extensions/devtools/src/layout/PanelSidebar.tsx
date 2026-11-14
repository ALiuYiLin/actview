// ============================================================
// 侧栏：组件树
// ============================================================

import { ActViewComponent, Component, Prop } from 'actview'
import { ComponentTree } from '../components/ComponentTree'
import type { ComponentRecord } from '../types'

@Component({ name: 'PanelSidebar' })
export class PanelSidebar extends ActViewComponent {
  @Prop
  components: ComponentRecord[] = []

  @Prop
  appId: number | null = null

  @Prop
  selectedId: number | null = null

  @Prop
  connected = false

  @Prop
  onComponentSelect: (id: number) => void = () => {}

  @Prop
  onClearHighlight: () => void = () => {}

  render() {
    return (
      <aside class="sidebar">
        <div class="sidebar-title">
          Components
          <button class="link" onClick={this.onClearHighlight}>
            clear highlight
          </button>
        </div>
        <div class="tree">
          <ComponentTree
            components={this.components}
            appId={this.appId}
            selectedId={this.selectedId}
            connected={this.connected}
            onComponentSelect={this.onComponentSelect}
          />
        </div>
      </aside>
    )
  }
}
