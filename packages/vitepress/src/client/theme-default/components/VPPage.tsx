import { ActViewComponent, Component, Dynamic, Prop } from 'actview'

export interface VPPageProps {
  content?: any
  children?: any
  pageTop?: any
  pageBottom?: any
}

export class VPPage extends ActViewComponent<VPPageProps> {
  content?: any
  pageTop?: any
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

Prop(VPPage.prototype, 'content')
Prop(VPPage.prototype, 'pageTop')
Prop(VPPage.prototype, 'pageBottom')
Component({ name: 'VPPage' })(VPPage)
