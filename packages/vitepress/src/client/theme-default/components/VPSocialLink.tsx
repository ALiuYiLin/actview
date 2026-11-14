import '../extract-css/VPSocialLink.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'

export interface VPSocialLinkProps {
  icon: any
  link: string
  ariaLabel?: string
  me?: boolean
}

export class VPSocialLink extends ActViewComponent<VPSocialLinkProps> {
  icon?: any
  link = ''
  ariaLabel?: string
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

for (const key of ['icon', 'link', 'ariaLabel', 'me'] as const) {
  Prop(VPSocialLink.prototype, key)
}
Component({ name: 'VPSocialLink' })(VPSocialLink)
