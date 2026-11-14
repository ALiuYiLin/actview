import '../extract-css/VPNavBarSearch.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'
import { VPNavBarSearchButton } from './VPNavBarSearchButton'

export interface VPNavBarSearchProps {
  class?: string
}

export class VPNavBarSearch extends ActViewComponent<VPNavBarSearchProps> {
  class?: string

  render() {
    return (
      <VPNavBarSearchButton
        class={this.$props.class}
        text="Search"
        onclick={() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('actview:search-open'))
          }
        }}
      />
    )
  }
}

Prop(VPNavBarSearch.prototype, 'class')
Component({ name: 'VPNavBarSearch' })(VPNavBarSearch)
