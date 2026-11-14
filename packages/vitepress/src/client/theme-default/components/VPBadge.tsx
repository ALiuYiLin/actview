import { ActViewComponent, Component, Prop } from 'actview'
import '../extract-css/VPBadge.scoped.css'
export interface VPBadgeProps {
  text?: string
  type?: 'info' | 'tip' | 'warning' | 'danger'
  children?: any
}

@Component({ name: 'VPBadge' })
export class VPBadge extends ActViewComponent<VPBadgeProps> {
  @Prop
  text?: string
  @Prop
  type?: VPBadgeProps['type']

  render() {
    const type = this.$props.type ?? 'tip'
    return (
      <span class={['VPBadge', type].filter(Boolean).join(' ')}>
        {this.$props.children ?? this.$props.text ?? null}
      </span>
    )
  }
}