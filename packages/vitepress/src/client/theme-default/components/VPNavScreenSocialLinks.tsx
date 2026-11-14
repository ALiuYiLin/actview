import { ActViewComponent, Component } from 'actview'
import { useData } from '../composables/data'
import { VPSocialLinks } from './VPSocialLinks'

export class VPNavScreenSocialLinks extends ActViewComponent {
  render() {
    const { theme } = useData()
    return theme.value.socialLinks ? (
      <VPSocialLinks
        class="VPNavScreenSocialLinks"
        links={theme.value.socialLinks}
      />
    ) : null
  }
}

Component({ name: 'VPNavScreenSocialLinks' })(VPNavScreenSocialLinks)
