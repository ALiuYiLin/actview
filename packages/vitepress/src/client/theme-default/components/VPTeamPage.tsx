import '../extract-css/VPTeamPage.css?scoped'
import { ActViewComponent, Component } from 'actview'

export interface VPTeamPageProps {
  children?: any
}

export class VPTeamPage extends ActViewComponent<VPTeamPageProps> {
  render() {
    return <div class="VPTeamPage">{this.$props.children}</div>
  }
}

Component({ name: 'VPTeamPage' })(VPTeamPage)
