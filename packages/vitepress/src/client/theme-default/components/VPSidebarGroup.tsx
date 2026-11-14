import { ActViewComponent, Component, Prop } from 'actview'
import { VPSidebarItem } from './VPSidebarItem'
import '../extract-css/VPSidebarGroup.scoped.css'
export interface VPSidebarGroupProps {
  items?: any[]
}

@Component({ name: 'VPSidebarGroup' })
export class VPSidebarGroup extends ActViewComponent<VPSidebarGroupProps> {
  @Prop
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