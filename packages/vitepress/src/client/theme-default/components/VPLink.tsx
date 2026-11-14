import '../extract-css/VPLink.css?scoped'
import { ActViewComponent, Component, Dynamic, Prop } from 'actview'

const EXTERNAL_URL_RE = /^https?:\/\//i

export interface VPLinkProps {
  tag?: string
  href?: string
  noIcon?: boolean
  external?: boolean
  target?: string
  rel?: string
  children?: any
}

export class VPLink extends ActViewComponent<VPLinkProps> {
  tag?: string
  href?: string
  noIcon?: boolean
  external?: boolean
  target?: string
  rel?: string

  render() {
    const props = this.$props
    const tag = props.tag ?? (props.href ? 'a' : 'span')
    const isExternal =
      props.external ?? (!!props.href && EXTERNAL_URL_RE.test(props.href))
    return (
      <Dynamic
        is={tag}
        class={[
          'VPLink',
          props.href ? 'link' : '',
          isExternal ? 'vp-external-link-icon' : '',
          props.noIcon ? 'no-icon' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        href={props.href}
        target={props.target ?? (isExternal ? '_blank' : undefined)}
        rel={props.rel ?? (isExternal ? 'noreferrer' : undefined)}
      >
        {props.children ?? null}
      </Dynamic>
    )
  }
}

for (const key of [
  'tag',
  'href',
  'noIcon',
  'external',
  'target',
  'rel',
] as const) {
  Prop(VPLink.prototype, key)
}
Component({ name: 'VPLink' })(VPLink)
