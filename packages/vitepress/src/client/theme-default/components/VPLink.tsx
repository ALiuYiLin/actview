import { ActViewComponent, Component, Dynamic, Prop } from 'actview'

const EXTERNAL_URL_RE = /^https?:\/\//i

export interface VPLinkProps {
  tag?: string
  href?: string
  noIcon?: boolean
  external?: boolean
  target?: string
  rel?: string
  onclick?: () => void
  children?: any
  [key: string]: any
}

@Component({ name: 'VPLink' })
export class VPLink extends ActViewComponent<VPLinkProps> {
  @Prop
  tag?: string
  @Prop
  href?: string
  @Prop
  noIcon?: boolean
  @Prop
  external?: boolean
  @Prop
  target?: string
  @Prop
  rel?: string

  @Prop
  onclick: any = undefined

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
        onClick={() => props.onclick?.()}
      >
        {props.children ?? null}
      </Dynamic>
    )
  }
}