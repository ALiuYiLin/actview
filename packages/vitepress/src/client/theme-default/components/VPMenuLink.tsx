import { ActViewComponent, Component, Prop } from 'actview'
import { useData } from '../composables/data'
import { isActive } from '../composables/layout'
import { VPLink } from './VPLink'
import '../extract-css/VPMenuLink.scoped.css'
export interface VPMenuLinkProps {
  item: any
  rel?: string
  [key: string]: any
}

@Component({ name: 'VPMenuLink' })
export class VPMenuLink extends ActViewComponent<VPMenuLinkProps> {
  @Prop
  item: any
  @Prop
  rel?: string

  render() {
    const { page } = useData()
    const item = this.$props.item ?? {}
    const href = typeof item.link === 'function' ? item.link(page.value) : item.link
    return (
      <div class="VPMenuLink">
        <VPLink
          class={isActive(page.value.relativePath, href) ? 'active' : undefined}
          href={href}
          target={item.target}
          rel={this.$props.rel ?? item.rel}
          noIcon={item.noIcon}
          hreflang={this.$props.hreflang}
          dir={this.$props.dir}
          lang={this.$props.lang}
          external={this.$props.external}
        >
          <span>{item.text ?? ''}</span>
        </VPLink>
      </div>
    )
  }
}