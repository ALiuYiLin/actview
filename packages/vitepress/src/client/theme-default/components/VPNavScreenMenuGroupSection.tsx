import '../extract-css/VPNavScreenMenuGroupSection.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'
import { VPNavScreenMenuGroupLink } from './VPNavScreenMenuGroupLink'

export interface VPNavScreenMenuGroupSectionProps {
  text?: string
  items?: any[]
}

export class VPNavScreenMenuGroupSection extends ActViewComponent<VPNavScreenMenuGroupSectionProps> {
  text?: string
  items?: any[]

  render() {
    const props = this.$props
    return (
      <div class="VPNavScreenMenuGroupSection">
        {props.text ? <p class="title">{props.text}</p> : null}
        {(props.items ?? []).map((item) => (
          <VPNavScreenMenuGroupLink key={item.text} item={item} />
        ))}
      </div>
    )
  }
}

Prop(VPNavScreenMenuGroupSection.prototype, 'text')
Prop(VPNavScreenMenuGroupSection.prototype, 'items')
Component({ name: 'VPNavScreenMenuGroupSection' })(VPNavScreenMenuGroupSection)
