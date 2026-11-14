import '../extract-css/VPNavBarAppearance.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'
import { useData } from '../composables/data'
import { VPSwitchAppearance } from './VPSwitchAppearance'

export interface VPNavBarAppearanceProps {
  class?: string
}

export class VPNavBarAppearance extends ActViewComponent<VPNavBarAppearanceProps> {
  class?: string

  render() {
    const { site } = useData()
    const appearance = site.value.appearance
    if (
      !appearance ||
      appearance === 'force-dark' ||
      appearance === 'force-auto'
    ) {
      return null
    }
    return (
      <div
        class={['VPNavBarAppearance', this.$props.class]
          .filter(Boolean)
          .join(' ')}
      >
        <VPSwitchAppearance />
      </div>
    )
  }
}

Prop(VPNavBarAppearance.prototype, 'class')
Component({ name: 'VPNavBarAppearance' })(VPNavBarAppearance)
