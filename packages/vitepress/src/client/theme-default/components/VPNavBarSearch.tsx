import { ActViewComponent, Component, Prop } from 'actview'
import { VPNavBarSearchButton } from './VPNavBarSearchButton'
import '../extract-css/VPNavBarSearch.scoped.css'
export interface VPNavBarSearchProps {
  class?: string
}

@Component({ name: 'VPNavBarSearch' })
export class VPNavBarSearch extends ActViewComponent<VPNavBarSearchProps> {
  @Prop
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