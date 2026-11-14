import '../extract-css/VPSkipLink.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'

export interface VPSkipLinkProps {
  label?: string
}

export class VPSkipLink extends ActViewComponent<VPSkipLinkProps> {
  label?: string

  render() {
    return (
      <a href="#VPContent" class="VPSkipLink visually-hidden">
        {this.$props.label || 'Skip to content'}
      </a>
    )
  }
}

Prop(VPSkipLink.prototype, 'label')
Component({ name: 'VPSkipLink' })(VPSkipLink)
