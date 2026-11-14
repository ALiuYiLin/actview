import { ActViewComponent, Component } from 'actview'
import '../extract-css/VPHomeContent.scoped.css'
export interface VPHomeContentProps {
  children?: any
}

@Component({ name: 'VPHomeContent' })
export class VPHomeContent extends ActViewComponent<VPHomeContentProps> {
  render() {
    const width = typeof window !== 'undefined' ? window.innerWidth : 0
    return (
      <div
        class="vp-doc container"
        style={
          width
            ? ({ '--vp-offset': `calc(50% - ${width / 2}px)` } as any)
            : {}
        }
      >
        {this.$props.children}
      </div>
    )
  }
}