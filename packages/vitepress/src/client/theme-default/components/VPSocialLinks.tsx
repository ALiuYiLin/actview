import '../extract-css/VPSocialLinks.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'
import { VPSocialLink } from './VPSocialLink'

export interface VPSocialLinksProps {
  links?: any[]
  me?: boolean
  class?: string
}

export class VPSocialLinks extends ActViewComponent<VPSocialLinksProps> {
  links?: any[]
  me?: boolean
  class?: string

  render() {
    const props = this.$props
    const me = props.me ?? true
    return (
      <div class={['VPSocialLinks', props.class].filter(Boolean).join(' ')}>
        {(props.links ?? []).map(({ link, icon, ariaLabel }) => (
          <VPSocialLink
            key={link}
            icon={icon}
            link={link}
            ariaLabel={ariaLabel}
            me={me}
          />
        ))}
      </div>
    )
  }
}

Prop(VPSocialLinks.prototype, 'links')
Prop(VPSocialLinks.prototype, 'me')
Prop(VPSocialLinks.prototype, 'class')
Component({ name: 'VPSocialLinks' })(VPSocialLinks)
