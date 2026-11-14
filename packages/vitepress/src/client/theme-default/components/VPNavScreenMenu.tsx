import { ActViewComponent, Component, Dynamic } from 'actview'
import { useData } from '../composables/data'
import { VPNavScreenMenuGroup } from './VPNavScreenMenuGroup'
import { VPNavScreenMenuLink } from './VPNavScreenMenuLink'

export class VPNavScreenMenu extends ActViewComponent {
  render() {
    const { theme } = useData()
    const nav = theme.value.nav
    if (!nav) return null
    return (
      <nav class="VPNavScreenMenu">
        {nav.map((item: any) => {
          const key = JSON.stringify(item)
          if ('link' in item) {
            return <VPNavScreenMenuLink key={key} item={item} />
          }
          if ('component' in item) {
            return (
              <Dynamic
                key={key}
                is={item.component}
                {...(item.props ?? {})}
                screen-menu
              />
            )
          }
          return (
            <VPNavScreenMenuGroup
              key={key}
              text={item.text || ''}
              items={item.items}
            />
          )
        })}
      </nav>
    )
  }
}

Component({ name: 'VPNavScreenMenu' })(VPNavScreenMenu)
