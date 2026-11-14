import { ActViewComponent, Component, Prop } from 'actview'
import '../extract-css/VPSkipLink.scoped.css'
export interface VPSkipLinkProps {
  label?: string
}

@Component({ name: 'VPSkipLink' })
export class VPSkipLink extends ActViewComponent<VPSkipLinkProps> {
  @Prop
  label?: string

  render() {
    return (
      <a href="#VPContent" class="VPSkipLink visually-hidden">
        {this.$props.label || 'Skip to content'}
      </a>
    )
  }
}