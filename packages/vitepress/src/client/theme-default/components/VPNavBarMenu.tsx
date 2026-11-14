import { ActViewComponent, Component, Dynamic, Prop } from 'actview'
import { useData } from '../composables/data'
import { VPNavBarMenuGroup } from './VPNavBarMenuGroup'
import { VPNavBarMenuLink } from './VPNavBarMenuLink'
import '../extract-css/VPNavBarMenu.scoped.css'
export interface VPNavBarMenuProps {
  class?: string
}

@Component({ name: 'VPNavBarMenu' })
export class VPNavBarMenu extends ActViewComponent<VPNavBarMenuProps> {
  @Prop
  class?: string

  render() {
    const { theme } = useData()
    const nav = theme.value.nav ?? []
    if (!nav.length) return null
    return (
      <nav
        aria-labelledby="main-nav-aria-label"
        class={['VPNavBarMenu', this.$props.class].filter(Boolean).join(' ')}
      >
        <span id="main-nav-aria-label" class="visually-hidden">
          Main Navigation
        </span>
        {nav.map((item: any) => {
          const key = JSON.stringify(item)
          if ('link' in item) {
            return <VPNavBarMenuLink key={key} item={item} />
          }
          if ('component' in item) {
            return (
              <Dynamic key={key} is={item.component} {...(item.props ?? {})} />
            )
          }
          return <VPNavBarMenuGroup key={key} item={item} />
        })}
      </nav>
    )
  }
}