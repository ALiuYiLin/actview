import '../extract-css/VPSidebarGroup.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'
import { VPSidebarItem } from './VPSidebarItem'

export interface VPSidebarGroupProps {
  items?: any[]
}

export class VPSidebarGroup extends ActViewComponent<VPSidebarGroupProps> {
  items?: any[]

  render() {
    return (
      <>
        {(this.$props.items ?? []).map((item) => (
          <div key={item.text} class="group">
            <VPSidebarItem item={item} depth={0} />
          </div>
        ))}
      </>
    )
  }
}

Prop(VPSidebarGroup.prototype, 'items')
Component({ name: 'VPSidebarGroup' })(VPSidebarGroup)
