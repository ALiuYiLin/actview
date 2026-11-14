import '../extract-css/VPSwitch.css?scoped'
import { ActViewComponent, Component } from 'actview'

export interface VPSwitchProps {
  children?: any
}

export class VPSwitch extends ActViewComponent<VPSwitchProps> {
  render() {
    const children = this.$props.children
    return (
      <button class="VPSwitch" type="button" role="switch">
        <span class="check">
          {children ? <span class="icon">{children}</span> : null}
        </span>
      </button>
    )
  }
}

Component({ name: 'VPSwitch' })(VPSwitch)
