import '../extract-css/VPSidebar.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'
import { useLayout } from '../composables/layout'
import { VPSidebarGroup } from './VPSidebarGroup'

export interface VPSidebarProps {
  open?: boolean
  sidebarNavBefore?: any
  sidebarNavAfter?: any
}

export class VPSidebar extends ActViewComponent<VPSidebarProps> {
  open?: boolean
  sidebarNavBefore?: any
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

Prop(VPSidebar.prototype, 'open')
Prop(VPSidebar.prototype, 'sidebarNavBefore')
Prop(VPSidebar.prototype, 'sidebarNavAfter')
Component({ name: 'VPSidebar' })(VPSidebar)
