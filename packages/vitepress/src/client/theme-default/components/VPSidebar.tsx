import { ActViewComponent, Component, Prop } from 'actview'
import { useLayout } from '../composables/layout'
import { VPSidebarGroup } from './VPSidebarGroup'
import '../extract-css/VPSidebar.scoped.css'
export interface VPSidebarProps {
  open?: boolean
  sidebarNavBefore?: any
  sidebarNavAfter?: any
}

@Component({ name: 'VPSidebar' })
export class VPSidebar extends ActViewComponent<VPSidebarProps> {
  @Prop
  open?: boolean
  @Prop
  sidebarNavBefore?: any
  @Prop
  sidebarNavAfter?: any

  render() {
    const { sidebarGroups, hasSidebar } = useLayout()
    if (!hasSidebar.value) return null
    return (
      <aside class={['VPSidebar', this.$props.open ? 'open' : ''].join(' ')}>
        <div class="curtain" />
        <nav
          class="nav"
          id="VPSidebarNav"
          aria-labelledby="sidebar-aria-label"
          tabindex="-1"
        >
          <span class="visually-hidden" id="sidebar-aria-label">
            Sidebar Navigation
          </span>
          {this.$props.sidebarNavBefore}
          <VPSidebarGroup items={sidebarGroups.value} />
          {this.$props.sidebarNavAfter}
        </nav>
      </aside>
    )
  }
}