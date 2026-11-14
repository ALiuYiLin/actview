import '../extract-css/VPNavScreenMenuGroupLink.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'
import { useData } from '../composables/data'
import { isActive } from '../composables/layout'
import { useNav } from '../composables/nav'
import { VPLink } from './VPLink'

export interface VPNavScreenMenuGroupLinkProps {
  item: any
}

export class VPNavScreenMenuGroupLink extends ActViewComponent<VPNavScreenMenuGroupLinkProps> {
  item: any

  render() {
    const { page } = useData()
    const { closeScreen } = useNav()
    const item = this.$props.item ?? {}
    const href = typeof item.link === 'function' ? item.link(page.value) : item.link
    const active = isActive(page.value.relativePath, item.activeMatch || href)
    return (
      <VPLink
        class={['VPNavScreenMenuGroupLink', active ? 'active' : ''].join(' ')}
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

Prop(VPNavScreenMenuGroupLink.prototype, 'item')
Component({ name: 'VPNavScreenMenuGroupLink' })(VPNavScreenMenuGroupLink)
