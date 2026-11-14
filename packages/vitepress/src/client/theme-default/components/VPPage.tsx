import { ActViewComponent, Component, Dynamic, Prop } from 'actview'

export interface VPPageProps {
  content?: any
  children?: any
  pageTop?: any
  pageBottom?: any
}

@Component({ name: 'VPPage' })
export class VPPage extends ActViewComponent<VPPageProps> {
  @Prop
  content?: any
  @Prop
  pageTop?: any
  @Prop
  pageBottom?: any

  render() {
    const props = this.$props
    return (
      <div class="VPPage">
        {props.pageTop}
        {props.content || props.children ? (
          <Dynamic is={props.content ?? props.children} />
        ) : null}
        {props.pageBottom}
      </div>
    )
  }
}