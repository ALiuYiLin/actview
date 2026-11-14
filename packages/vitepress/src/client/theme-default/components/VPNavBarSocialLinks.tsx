import { ActViewComponent, Component, Prop } from 'actview'
import { useData } from '../composables/data'
import { VPSocialLinks } from './VPSocialLinks'
import '../extract-css/VPNavBarSocialLinks.scoped.css'
export interface VPNavBarSocialLinksProps {
  class?: string
}

@Component({ name: 'VPNavBarSocialLinks' })
export class VPNavBarSocialLinks extends ActViewComponent<VPNavBarSocialLinksProps> {
  @Prop
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