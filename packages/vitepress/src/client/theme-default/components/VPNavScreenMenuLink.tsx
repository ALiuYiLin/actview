import '../extract-css/VPNavScreenMenuLink.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'
import { useData } from '../composables/data'
import { isActive } from '../composables/layout'
import { useNav } from '../composables/nav'
import { VPLink } from './VPLink'

export interface VPNavScreenMenuLinkProps {
  item: any
}

export class VPNavScreenMenuLink extends ActViewComponent<VPNavScreenMenuLinkProps> {
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

Prop(VPNavScreenMenuLink.prototype, 'item')
Component({ name: 'VPNavScreenMenuLink' })(VPNavScreenMenuLink)
