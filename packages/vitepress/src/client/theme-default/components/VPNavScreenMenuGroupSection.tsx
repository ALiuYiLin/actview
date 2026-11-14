import { ActViewComponent, Component, Prop } from 'actview'
import { VPNavScreenMenuGroupLink } from './VPNavScreenMenuGroupLink'
import '../extract-css/VPNavScreenMenuGroupSection.scoped.css'
export interface VPNavScreenMenuGroupSectionProps {
  text?: string
  items?: any[]
}

@Component({ name: 'VPNavScreenMenuGroupSection' })
export class VPNavScreenMenuGroupSection extends ActViewComponent<VPNavScreenMenuGroupSectionProps> {
  @Prop
  text?: string
  @Prop
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