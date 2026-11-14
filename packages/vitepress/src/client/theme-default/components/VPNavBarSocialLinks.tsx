import '../extract-css/VPNavBarSocialLinks.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'
import { useData } from '../composables/data'
import { VPSocialLinks } from './VPSocialLinks'

export interface VPNavBarSocialLinksProps {
  class?: string
}

export class VPNavBarSocialLinks extends ActViewComponent<VPNavBarSocialLinksProps> {
  class?: string

  render() {
    const { theme } = useData()
    if (!theme.value.socialLinks) return null
    return (
      <VPSocialLinks
        class={['VPNavBarSocialLinks', this.$props.class].filter(Boolean).join(' ')}
        links={theme.value.socialLinks}
      />
    )
  }
}

Prop(VPNavBarSocialLinks.prototype, 'class')
Component({ name: 'VPNavBarSocialLinks' })(VPNavBarSocialLinks)
