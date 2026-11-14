import { ActViewComponent, Component, Prop } from 'actview'
import { VPNavScreenAppearance } from './VPNavScreenAppearance'
import { VPNavScreenMenu } from './VPNavScreenMenu'
import { VPNavScreenSocialLinks } from './VPNavScreenSocialLinks'
import '../extract-css/VPNavScreen.scoped.css'
export interface VPNavScreenProps {
  open?: boolean
  navScreenContentBefore?: any
  navScreenContentAfter?: any
}

@Component({ name: 'VPNavScreen' })
export class VPNavScreen extends ActViewComponent<VPNavScreenProps> {
  @Prop
  open?: boolean
  @Prop
  navScreenContentBefore?: any
  @Prop
  navScreenContentAfter?: any

  render() {
    if (!this.$props.open) return null
    return (
      <div class="VPNavScreen" id="VPNavScreen">
        <div class="container">
          {this.$props.navScreenContentBefore}
          <VPNavScreenMenu />
          <VPNavScreenAppearance />
          <VPNavScreenSocialLinks />
          {this.$props.navScreenContentAfter}
        </div>
      </div>
    )
  }
}