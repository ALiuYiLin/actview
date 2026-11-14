import { ActViewComponent, Component, Dynamic, Prop } from 'actview'
import { VPMenuGroup } from './VPMenuGroup'
import { VPMenuLink } from './VPMenuLink'
import '../extract-css/VPMenu.scoped.css'
export interface VPMenuProps {
  items?: any[]
  children?: any
}

@Component({ name: 'VPMenu' })
export class VPMenu extends ActViewComponent<VPMenuProps> {
  @Prop
  items?: any[]

  render() {
    const items = this.$props.items ?? []
    return (
      <div class="VPMenu">
        {items.length ? (
          <div class="items">
            {items.map((item) => {
              const key = JSON.stringify(item)
              if ('link' in item) {
                return <VPMenuLink key={key} item={item} />
              }
              if ('component' in item) {
                return (
                  <Dynamic
                    key={key}
                    is={item.component}
                    {...(item.props ?? {})}
                  />
                )
              }
              return (
                <VPMenuGroup key={key} text={item.text} items={item.items} />
              )
            })}
          </div>
        ) : null}
        {this.$props.children ?? null}
      </div>
    )
  }
}