import '../extract-css/VPButton.css?scoped'
import { ActViewComponent, Component, Dynamic, Prop } from 'actview'

const EXTERNAL_URL_RE = /^https?:\/\//i

export interface VPButtonProps {
  tag?: string
  size?: 'medium' | 'big'
  theme?: 'brand' | 'alt' | 'sponsor'
  text?: string
  href?: string
  target?: string
  rel?: string
  children?: any
}

function normalizeHref(href: string): string {
  return href
}

export class VPButton extends ActViewComponent<VPButtonProps> {
  tag?: string
  size?: 'medium' | 'big'
  theme?: 'brand' | 'alt' | 'sponsor'
  text?: string
  href?: string
  target?: string
  rel?: string

  render() {
    const props = this.$props
    const size = props.size ?? 'medium'
    const theme = props.theme ?? 'brand'
    const isExternal = !!(props.href && EXTERNAL_URL_RE.test(props.href))
    const tag = props.tag || (props.href ? 'a' : 'button')
    return (
      <Dynamic
        is={tag}
        class={['VPButton', size, theme].filter(Boolean).join(' ')}
        href={props.href ? normalizeHref(props.href) : undefined}
        target={props.target ?? (isExternal ? '_blank' : undefined)}
        rel={props.rel ?? (isExternal ? 'noreferrer' : undefined)}
      >
        {props.children ?? props.text ?? null}
      </Dynamic>
    )
  }
}

for (const key of [
  'tag',
  'size',
  'theme',
  'text',
  'href',
  'target',
  'rel',
] as const) {
  Prop(VPButton.prototype, key)
}
Component({ name: 'VPButton' })(VPButton)
