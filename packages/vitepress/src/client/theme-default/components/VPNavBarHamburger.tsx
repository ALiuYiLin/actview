import { ActViewComponent, Component, Prop } from 'actview'
import '../extract-css/VPNavBarHamburger.scoped.css'
export interface VPNavBarHamburgerProps {
  active?: boolean
  class?: string
  onclick?: () => void
}

@Component({ name: 'VPNavBarHamburger' })
export class VPNavBarHamburger extends ActViewComponent<VPNavBarHamburgerProps> {
  @Prop
  active?: boolean
  @Prop
  class?: string
  @Prop
  onclick?: () => void

  render() {
    const props = this.$props
    return (
      <button
        type="button"
        class={['VPNavBarHamburger', props.active ? 'active' : '', props.class]
          .filter(Boolean)
          .join(' ')}
        aria-label="mobile navigation"
        aria-expanded={props.active}
        aria-controls="VPNavScreen"
        onClick={() => props.onclick?.()}
      >
        <span class="container">
          <span class="top" />
          <span class="middle" />
          <span class="bottom" />
        </span>
      </button>
    )
  }
}