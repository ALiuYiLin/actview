import '../extract-css/VPNavBarHamburger.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'

export interface VPNavBarHamburgerProps {
  active?: boolean
  class?: string
  onclick?: () => void
}

export class VPNavBarHamburger extends ActViewComponent<VPNavBarHamburgerProps> {
  active?: boolean
  class?: string
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

Prop(VPNavBarHamburger.prototype, 'active')
Prop(VPNavBarHamburger.prototype, 'class')
Prop(VPNavBarHamburger.prototype, 'onclick')
Component({ name: 'VPNavBarHamburger' })(VPNavBarHamburger)
