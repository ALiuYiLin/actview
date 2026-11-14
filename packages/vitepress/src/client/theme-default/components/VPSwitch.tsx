import '../extract-css/VPSwitch.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'

export interface VPSwitchProps {
  children?: any
  class?: string
  title?: string
  ariaChecked?: boolean
  onclick?: () => void
}

export class VPSwitch extends ActViewComponent<VPSwitchProps> {
  class?: string
  title?: string
  ariaChecked?: boolean
  onclick?: () => void

  render() {
    const children = this.$props.children
    return (
      <button
        class={['VPSwitch', this.$props.class].filter(Boolean).join(' ')}
        type="button"
        role="switch"
        title={this.$props.title}
        aria-checked={this.$props.ariaChecked}
        onClick={() => this.$props.onclick?.()}
      >
        <span class="check">
          {children ? <span class="icon">{children}</span> : null}
        </span>
      </button>
    )
  }
}

Prop(VPSwitch.prototype, 'class')
Prop(VPSwitch.prototype, 'title')
Prop(VPSwitch.prototype, 'ariaChecked')
Prop(VPSwitch.prototype, 'onclick')
Component({ name: 'VPSwitch' })(VPSwitch)
