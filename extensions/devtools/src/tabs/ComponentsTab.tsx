// ============================================================
// Components Tab
// ============================================================

import { ActViewComponent, Component, Prop } from 'actview'
import { ComponentDetails } from '../components/ComponentDetails'
import type { ComponentRecord, StateSnapshot } from '../types'

@Component({ name: 'ComponentsTab' })
export class ComponentsTab extends ActViewComponent {
  @Prop
  component: ComponentRecord | null = null

  @Prop
  state: StateSnapshot | null = null

  render() {
    return (
      <section class="tab-panel">
        <ComponentDetails component={this.component} state={this.state} />
      </section>
    )
  }
}
