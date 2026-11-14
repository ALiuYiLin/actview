import { ActViewComponent, Component, Dynamic, Prop, Ref } from 'actview'
import { useData } from '../composables/data'
import { isActive } from '../composables/layout'
import { VPLink } from './VPLink'
import '../extract-css/VPSidebarItem.scoped.css'
export interface VPSidebarItemProps {
  item: any
  depth?: number
}

@Component({ name: 'VPSidebarItem' })
export class VPSidebarItem extends ActViewComponent<VPSidebarItemProps> {
  @Prop
  item: any
  @Prop
  depth = 0
  @Ref
  collapsed = false

  render() {
    const item = this.$props.item ?? {}
    const depth = this.$props.depth ?? 0
    const hasChildren = !!(item.items && item.items.length)
    const isLink = !!item.link
    const { page } = useData()
    const active = isActive(page.value.relativePath, item.link)
    const collapsible = item.collapsed != null
    const classes = [
      `level-${depth}`,
      collapsible ? 'collapsible' : '',
      this.collapsed ? 'collapsed' : '',
      isLink ? 'is-link' : '',
      active ? 'is-active' : '',
      active ? 'has-active' : '',
    ]
      .filter(Boolean)
      .join(' ')
    const toggle = () => {
      if (isLink || collapsible) this.collapsed = !this.collapsed
    }
    return (
      <Dynamic is={hasChildren ? 'section' : 'div'} class={['VPSidebarItem', classes].join(' ')}>
        {item.text ? (
          <div
            class="item"
            role={isLink ? undefined : 'button'}
            tabindex={hasChildren ? 0 : undefined}
            onClick={() => {
              if (!isLink) toggle()
            }}
          >
            <div class="indicator" />
            {item.link ? (
              <VPLink
                tag="a"
                class="link"
                href={item.link}
                rel={item.rel}
                target={item.target}
              >
                <span class="text">{item.text}</span>
              </VPLink>
            ) : (
              <span class="text">{item.text}</span>
            )}
            {collapsible && hasChildren ? (
              <div
                class="caret"
                role="button"
                aria-label="toggle section"
                tabindex="0"
                onClick={(e: MouseEvent) => {
                  e.stopPropagation()
                  this.collapsed = !this.collapsed
                }}
              >
                <span class="vpi-chevron-right caret-icon" />
              </div>
            ) : null}
          </div>
        ) : null}
        {hasChildren && depth < 5 ? (
          <div class="items">
            {item.items.map((child: any) => (
              <VPSidebarItem key={child.text} item={child} depth={depth + 1} />
            ))}
          </div>
        ) : null}
      </Dynamic>
    )
  }
}