import { ActViewComponent, Component, Prop } from 'actview'
import '../extract-css/VPTeamPageTitle.scoped.css'
export interface VPTeamPageTitleProps {
  title?: any
  lead?: any
}

@Component({ name: 'VPTeamPageTitle' })
export class VPTeamPageTitle extends ActViewComponent<VPTeamPageTitleProps> {
  @Prop
  title?: any
  @Prop
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