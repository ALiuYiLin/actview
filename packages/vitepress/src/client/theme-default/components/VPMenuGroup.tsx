import { ActViewComponent, Component, Prop } from 'actview'
import { VPMenuLink } from './VPMenuLink'
import '../extract-css/VPMenuGroup.scoped.css'
export interface VPMenuGroupProps {
  text?: string
  items?: any[]
}

@Component({ name: 'VPMenuGroup' })
export class VPMenuGroup extends ActViewComponent<VPMenuGroupProps> {
  @Prop
  text?: string
  @Prop
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