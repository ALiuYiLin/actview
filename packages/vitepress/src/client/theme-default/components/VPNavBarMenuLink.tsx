import { ActViewComponent, Component, Prop } from 'actview'
import { useData } from '../composables/data'
import { isActive } from '../composables/layout'
import { VPLink } from './VPLink'
import '../extract-css/VPNavBarMenuLink.scoped.css'
export interface VPNavBarMenuLinkProps {
  item: any
}

@Component({ name: 'VPNavBarMenuLink' })
export class VPNavBarMenuLink extends ActViewComponent<VPNavBarMenuLinkProps> {
  @Prop
  item: any

  render() {
    const { page } = useData()
    const item = this.$props.item ?? {}
    const href = typeof item.link === 'function' ? item.link(page.value) : item.link
    const active = isActive(
      page.value.relativePath,
      item.activeMatch || href,
    )
    return (
      <VPLink
        class={['VPNavBarMenuLink', active ? 'active' : ''].join(' ')}
        href={href}
        target={item.target}
        rel={item.rel}
        noIcon={item.noIcon}
        tabindex="0"
      >
        <span>{item.text ?? ''}</span>
      </VPLink>
    )
  }
}