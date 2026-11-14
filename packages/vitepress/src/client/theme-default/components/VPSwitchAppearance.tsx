import { ActViewComponent, Component } from 'actview'
import { useData } from '../composables/data'
import { VPSwitch } from './VPSwitch'
import '../extract-css/VPSwitchAppearance.scoped.css'
@Component({ name: 'VPSwitchAppearance' })
export class VPSwitchAppearance extends ActViewComponent {
  render() {
    const { isDark, setAppearance, theme } = useData()
    return (
      <VPSwitch
        class="VPSwitchAppearance"
        title={
          isDark.value
            ? theme.value.lightModeSwitchTitle || 'Switch to light theme'
            : theme.value.darkModeSwitchTitle || 'Switch to dark theme'
        }
        ariaChecked={isDark.value}
        onclick={() => setAppearance(isDark.value ? 'light' : 'dark')}
      >
        <span class="vpi-sun sun" />
        <span class="vpi-moon moon" />
      </VPSwitch>
    )
  }
}