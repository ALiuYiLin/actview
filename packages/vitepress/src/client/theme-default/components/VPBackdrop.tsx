import { ActViewComponent, Component, Prop } from 'actview'
import '../extract-css/VPBackdrop.scoped.css'
export interface VPBackdropProps {
  show?: boolean
  class?: string
  onclick?: (e: MouseEvent) => void
}

@Component({ name: 'VPBackdrop' })
export class VPBackdrop extends ActViewComponent<VPBackdropProps> {
  @Prop
  show?: boolean
  @Prop
  class?: string
  @Prop
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