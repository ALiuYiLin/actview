import '../extract-css/VPNavScreen.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'
import { VPNavScreenAppearance } from './VPNavScreenAppearance'
import { VPNavScreenMenu } from './VPNavScreenMenu'
import { VPNavScreenSocialLinks } from './VPNavScreenSocialLinks'

export interface VPNavScreenProps {
  open?: boolean
  navScreenContentBefore?: any
  navScreenContentAfter?: any
}

export class VPNavScreen extends ActViewComponent<VPNavScreenProps> {
  open?: boolean
  navScreenContentBefore?: any
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

Prop(VPNavScreen.prototype, 'open')
Prop(VPNavScreen.prototype, 'navScreenContentBefore')
Prop(VPNavScreen.prototype, 'navScreenContentAfter')
Component({ name: 'VPNavScreen' })(VPNavScreen)
