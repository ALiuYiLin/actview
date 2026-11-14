import '../extract-css/VPLocalNav.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'
import { useLayout } from '../composables/layout'

export interface VPLocalNavProps {
  open?: boolean
  onOpenMenu?: () => void
}

export class VPLocalNav extends ActViewComponent<VPLocalNavProps> {
  open?: boolean
  onOpenMenu?: () => void

  render() {
    const { hasSidebar, hasLocalNav } = useLayout()
    if (!hasSidebar.value && !hasLocalNav.value) return null
    return (
      <div class={['VPLocalNav', hasSidebar.value ? 'has-sidebar' : ''].join(' ')}>
        {hasSidebar.value ? (
          <button
            class="menu"
            aria-expanded={this.$props.open}
            aria-controls="VPSidebarNav"
            onClick={() => this.$props.onOpenMenu?.()}
          >
            <span class="vpi-align-left menu-icon" />
            <span class="menu-text">Menu</span>
          </button>
        ) : null}
        {hasLocalNav.value ? (
          <div class="outline">
            <span class="outline-text">On this page</span>
          </div>
        ) : null}
      </div>
    )
  }
}

Prop(VPLocalNav.prototype, 'open')
Prop(VPLocalNav.prototype, 'onOpenMenu')
Component({ name: 'VPLocalNav' })(VPLocalNav)
