import '../extract-css/VPBadge.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'

export interface VPBadgeProps {
  text?: string
  type?: 'info' | 'tip' | 'warning' | 'danger'
  children?: any
}

export class VPBadge extends ActViewComponent<VPBadgeProps> {
  text?: string
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

Prop(VPBadge.prototype, 'text')
Prop(VPBadge.prototype, 'type')
Component({ name: 'VPBadge' })(VPBadge)
