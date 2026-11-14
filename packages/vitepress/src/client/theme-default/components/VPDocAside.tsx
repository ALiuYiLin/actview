import '../extract-css/VPDocAside.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'
import { useData } from '../composables/data'
import { VPDocAsideCarbonAds } from './VPDocAsideCarbonAds'
import { VPDocAsideOutline } from './VPDocAsideOutline'

export interface VPDocAsideProps {
  asideTop?: any
  asideBottom?: any
  asideOutlineBefore?: any
  asideOutlineAfter?: any
  asideAdsBefore?: any
  asideAdsAfter?: any
}

export class VPDocAside extends ActViewComponent<VPDocAsideProps> {
  asideTop?: any
  asideBottom?: any
  asideOutlineBefore?: any
  asideOutlineAfter?: any
  asideAdsBefore?: any
  asideAdsAfter?: any

  render() {
    const props = this.$props
    const { theme } = useData()
    return (
      <div class="VPDocAside">
        {props.asideTop}
        {props.asideOutlineBefore}
        <VPDocAsideOutline />
        {props.asideOutlineAfter}
        <div class="spacer" />
        {props.asideAdsBefore}
        {theme.value.carbonAds ? (
          <VPDocAsideCarbonAds carbonAds={theme.value.carbonAds} />
        ) : null}
        {props.asideAdsAfter}
        {props.asideBottom}
      </div>
    )
  }
}

for (const key of [
  'asideTop',
  'asideBottom',
  'asideOutlineBefore',
  'asideOutlineAfter',
  'asideAdsBefore',
  'asideAdsAfter',
] as const) {
  Prop(VPDocAside.prototype, key)
}
Component({ name: 'VPDocAside' })(VPDocAside)
