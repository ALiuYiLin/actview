import '../extract-css/VPBackdrop.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'

export interface VPBackdropProps {
  show?: boolean
  class?: string
  onclick?: (e: MouseEvent) => void
}

export class VPBackdrop extends ActViewComponent<VPBackdropProps> {
  show?: boolean
  class?: string
  onclick?: (e: MouseEvent) => void

  render() {
    if (!this.$props.show) return null
    return (
      <div
        class={['VPBackdrop', this.$props.class].filter(Boolean).join(' ')}
        onClick={(e) => this.$props.onclick?.(e)}
      />
    )
  }
}

Prop(VPBackdrop.prototype, 'show')
Prop(VPBackdrop.prototype, 'class')
Prop(VPBackdrop.prototype, 'onclick')
Component({ name: 'VPBackdrop' })(VPBackdrop)
