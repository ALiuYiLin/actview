import { ActViewComponent, Component, Prop } from 'actview'
import { useData } from '../composables/data'
import { VPSocialLinks } from './VPSocialLinks'
import { VPSwitchAppearance } from './VPSwitchAppearance'
import '../extract-css/VPNavBarExtra.scoped.css'
export interface VPNavBarExtraProps {
  class?: string
}

@Component({ name: 'VPNavBarExtra' })
export class VPNavBarExtra extends ActViewComponent<VPNavBarExtraProps> {
  @Prop
  class?: string

  render() {
    const { theme } = useData()
    const hasExtra =
      !!theme.value.socialLinks || !!theme.value.appearance
    if (!hasExtra) return null
    return (
      <div class={['VPNavBarExtra', this.$props.class].filter(Boolean).join(' ')}>
        {theme.value.appearance ? <VPSwitchAppearance /> : null}
        {theme.value.socialLinks ? (
          <VPSocialLinks links={theme.value.socialLinks} />
        ) : null}
      </div>
    )
  }
}