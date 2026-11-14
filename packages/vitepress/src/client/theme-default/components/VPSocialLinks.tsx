import { ActViewComponent, Component, Prop } from 'actview'
import { VPSocialLink } from './VPSocialLink'
import '../extract-css/VPSocialLinks.scoped.css'
export interface VPSocialLinksProps {
  links?: any[]
  me?: boolean
  class?: string
}

@Component({ name: 'VPSocialLinks' })
export class VPSocialLinks extends ActViewComponent<VPSocialLinksProps> {
  @Prop
  links?: any[]
  @Prop
  me?: boolean
  @Prop
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