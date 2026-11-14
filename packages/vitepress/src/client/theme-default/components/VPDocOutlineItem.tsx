import { ActViewComponent, Component, Prop } from 'actview'
import '../extract-css/VPDocOutlineItem.scoped.css'
export interface VPDocOutlineItemProps {
  headers?: any[]
  root?: boolean
}

@Component({ name: 'VPDocOutlineItem' })
export class VPDocOutlineItem extends ActViewComponent<VPDocOutlineItemProps> {
  @Prop
  headers?: any[]
  @Prop
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