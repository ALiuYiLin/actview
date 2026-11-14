import '../extract-css/VPDocOutlineItem.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'

export interface VPDocOutlineItemProps {
  headers?: any[]
  root?: boolean
}

export class VPDocOutlineItem extends ActViewComponent<VPDocOutlineItemProps> {
  headers?: any[]
  root?: boolean

  render() {
    const props = this.$props
    return (
      <ul class={['VPDocOutlineItem', props.root ? 'root' : 'nested'].join(' ')}>
        {(props.headers ?? []).map(({ children, link, title }: any) => (
          <li>
            <a class="outline-link" href={link} title={title}>
              {title}
            </a>
            {children?.length ? (
              <VPDocOutlineItem headers={children} />
            ) : null}
          </li>
        ))}
      </ul>
    )
  }
}

Prop(VPDocOutlineItem.prototype, 'headers')
Prop(VPDocOutlineItem.prototype, 'root')
Component({ name: 'VPDocOutlineItem' })(VPDocOutlineItem)
