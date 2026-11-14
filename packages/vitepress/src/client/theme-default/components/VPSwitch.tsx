import { ActViewComponent, Component, Prop } from 'actview'
import '../extract-css/VPSwitch.scoped.css'
export interface VPSwitchProps {
  children?: any
  class?: string
  title?: string
  ariaChecked?: boolean
  onclick?: () => void
}

@Component({ name: 'VPSwitch' })
export class VPSwitch extends ActViewComponent<VPSwitchProps> {
  @Prop
  class?: string
  @Prop
  title?: string
  @Prop
  ariaChecked?: boolean
  @Prop
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