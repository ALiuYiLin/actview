import { ActViewComponent, Component, Prop } from 'actview'
import { useData } from '../composables/data'
import { isActive } from '../composables/layout'
import { VPFlyout } from './VPFlyout'

export interface VPNavBarMenuGroupProps {
  item: any
}

function childActive(navItem: any, page: any): boolean {
  if ('component' in navItem) return false
  if ('link' in navItem) {
    const href =
      typeof navItem.link === 'function'
        ? navItem.link(page)
        : navItem.link
    return isActive(page.relativePath, navItem.activeMatch || href)
  }
  return (navItem.items ?? []).some((item: any) => childActive(item, page))
}

@Component({ name: 'VPNavBarMenuGroup' })
export class VPNavBarMenuGroup extends ActViewComponent<VPNavBarMenuGroupProps> {
  @Prop
  item: any

  render() {
    const { page } = useData()
    const item = this.$props.item ?? {}
    const active = item.activeMatch
      ? isActive(page.value.relativePath, item.activeMatch)
      : childActive(item, page.value)
    return (
      <VPFlyout
        class={['VPNavBarMenuGroup', active ? 'active' : ''].join(' ')}
        button={item.text}
        items={item.items}
      />
    )
  }
}