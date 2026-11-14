import '../extract-css/VPTeamPageTitle.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'

export interface VPTeamPageTitleProps {
  title?: any
  lead?: any
}

export class VPTeamPageTitle extends ActViewComponent<VPTeamPageTitleProps> {
  title?: any
  lead?: any

  render() {
    return (
      <div class="VPTeamPageTitle">
        {this.$props.title ? <h1 class="title">{this.$props.title}</h1> : null}
        {this.$props.lead ? <p class="lead">{this.$props.lead}</p> : null}
      </div>
    )
  }
}

Prop(VPTeamPageTitle.prototype, 'title')
Prop(VPTeamPageTitle.prototype, 'lead')
Component({ name: 'VPTeamPageTitle' })(VPTeamPageTitle)
