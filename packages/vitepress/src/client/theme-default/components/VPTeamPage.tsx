import { ActViewComponent, Component } from 'actview'
import '../extract-css/VPTeamPage.scoped.css'
export interface VPTeamPageProps {
  children?: any
}

@Component({ name: 'VPTeamPage' })
export class VPTeamPage extends ActViewComponent<VPTeamPageProps> {
  render() {
    return <div class="VPTeamPage">{this.$props.children}</div>
  }
}