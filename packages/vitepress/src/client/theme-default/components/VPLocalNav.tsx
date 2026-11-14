import { ActViewComponent, Component, Prop } from 'actview'
import { useLayout } from '../composables/layout'
import '../extract-css/VPLocalNav.scoped.css'
export interface VPLocalNavProps {
  open?: boolean
  onOpenMenu?: () => void
}

@Component({ name: 'VPLocalNav' })
export class VPLocalNav extends ActViewComponent<VPLocalNavProps> {
  @Prop
  open?: boolean
  @Prop
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