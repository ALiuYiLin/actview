import '../extract-css/VPNavScreenAppearance.css?scoped'
import { ActViewComponent, Component } from 'actview'
import { useData } from '../composables/data'
import { VPSwitchAppearance } from './VPSwitchAppearance'

export class VPNavScreenAppearance extends ActViewComponent {
  render() {
    const { site, theme } = useData()
    const appearance = site.value.appearance
    if (
      !appearance ||
      appearance === 'force-dark' ||
      appearance === 'force-auto'
    ) {
      return null
    }
    return (
      <div class="VPNavScreenAppearance">
        <p class="text">{theme.value.darkModeSwitchLabel || 'Appearance'}</p>
        <VPSwitchAppearance />
      </div>
    )
  }
}

Component({ name: 'VPNavScreenAppearance' })(VPNavScreenAppearance)
