import { ActViewComponent, Component, Prop } from 'actview'
import '../extract-css/VPTeamPageSection.scoped.css'
export interface VPTeamPageSectionProps {
  title?: any
  lead?: any
  members?: any
}

@Component({ name: 'VPTeamPageSection' })
export class VPTeamPageSection extends ActViewComponent<VPTeamPageSectionProps> {
  @Prop
  title?: any
  @Prop
  lead?: any
  @Prop
  members?: any

  render() {
    const props = this.$props
    return (
      <section class="VPTeamPageSection">
        <div class="title">
          <div class="title-line" />
          {props.title ? <h2 class="title-text">{props.title}</h2> : null}
        </div>
        {props.lead ? <p class="lead">{props.lead}</p> : null}
        {props.members ? <div class="members">{props.members}</div> : null}
      </section>
    )
  }
}