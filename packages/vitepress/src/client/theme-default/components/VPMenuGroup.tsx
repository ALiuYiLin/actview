import '../extract-css/VPMenuGroup.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'
import { VPMenuLink } from './VPMenuLink'

export interface VPMenuGroupProps {
  text?: string
  items?: any[]
}

export class VPMenuGroup extends ActViewComponent<VPMenuGroupProps> {
  text?: string
  items?: any[]

  render() {
    const props = this.$props
    return (
      <div class="VPMenuGroup">
        {props.text ? <p class="title">{props.text}</p> : null}
        {(props.items ?? []).map((item, index) =>
          'link' in item ? <VPMenuLink key={index} item={item} /> : null,
        )}
      </div>
    )
  }
}

Prop(VPMenuGroup.prototype, 'text')
Prop(VPMenuGroup.prototype, 'items')
Component({ name: 'VPMenuGroup' })(VPMenuGroup)
