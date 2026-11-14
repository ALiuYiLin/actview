import { ActViewComponent, Component, Prop } from 'actview'
import '../extract-css/VPSocialLink.scoped.css'
export interface VPSocialLinkProps {
  icon: any
  link: string
  ariaLabel?: string
  me?: boolean
}

@Component({ name: 'VPSocialLink' })
export class VPSocialLink extends ActViewComponent<VPSocialLinkProps> {
  @Prop
  icon?: any
  @Prop
  link = ''
  @Prop
  ariaLabel?: string
  @Prop
  me = true

  render() {
    const props = this.$props
    const isObject = props.icon && typeof props.icon === 'object'
    const iconClass =
      typeof props.icon === 'string' ? `vpi-social-${props.icon}` : ''
    return (
      <a
        class="VPSocialLink no-icon"
        href={props.link}
        aria-label={props.ariaLabel ?? (typeof props.icon === 'string' ? props.icon : '')}
        target="_blank"
        rel={props.me ?? true ? 'me noopener' : 'noopener'}
        {...(isObject ? ({ innerHTML: props.icon.svg } as any) : {})}
      >
        {isObject ? null : <span class={iconClass} />}
      </a>
    )
  }
}