import { ActViewComponent, Component, Prop } from 'actview'
import { useData } from '../composables/data'
import { VPSwitchAppearance } from './VPSwitchAppearance'
import '../extract-css/VPNavBarAppearance.scoped.css'
export interface VPNavBarAppearanceProps {
  class?: string
}

@Component({ name: 'VPNavBarAppearance' })
export class VPNavBarAppearance extends ActViewComponent<VPNavBarAppearanceProps> {
  @Prop
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