import { ActViewComponent, Component, Prop } from 'actview'
import { useData } from '../composables/data'
import { isActive } from '../composables/layout'
import { useNav } from '../composables/nav'
import { VPLink } from './VPLink'
import '../extract-css/VPNavScreenMenuLink.scoped.css'
export interface VPNavScreenMenuLinkProps {
  item: any
}

@Component({ name: 'VPNavScreenMenuLink' })
export class VPNavScreenMenuLink extends ActViewComponent<VPNavScreenMenuLinkProps> {
  @Prop
  item: any

  render() {
    const { page } = useData()
    const { closeScreen } = useNav()
    const item = this.$props.item ?? {}
    const href = typeof item.link === 'function' ? item.link(page.value) : item.link
    const active = isActive(page.value.relativePath, item.activeMatch || href)
    return (
      <VPLink
        class={['VPNavScreenMenuLink', active ? 'active' : ''].join(' ')}
        href={href}
        target={item.target}
        rel={item.rel}
        noIcon={item.noIcon}
        onclick={closeScreen}
      >
        <span>{item.text}</span>
      </VPLink>
    )
  }
}