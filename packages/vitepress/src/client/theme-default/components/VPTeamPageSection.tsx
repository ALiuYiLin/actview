import '../extract-css/VPTeamPageSection.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'

export interface VPTeamPageSectionProps {
  title?: any
  lead?: any
  members?: any
}

export class VPTeamPageSection extends ActViewComponent<VPTeamPageSectionProps> {
  title?: any
  lead?: any
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

Prop(VPTeamPageSection.prototype, 'title')
Prop(VPTeamPageSection.prototype, 'lead')
Prop(VPTeamPageSection.prototype, 'members')
Component({ name: 'VPTeamPageSection' })(VPTeamPageSection)
