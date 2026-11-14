import { ActViewComponent, Component, Prop } from 'actview'
import { useData } from '../composables/data'
import { VPDocAsideCarbonAds } from './VPDocAsideCarbonAds'
import { VPDocAsideOutline } from './VPDocAsideOutline'
import '../extract-css/VPDocAside.scoped.css'
export interface VPDocAsideProps {
  asideTop?: any
  asideBottom?: any
  asideOutlineBefore?: any
  asideOutlineAfter?: any
  asideAdsBefore?: any
  asideAdsAfter?: any
}

@Component({ name: 'VPDocAside' })
export class VPDocAside extends ActViewComponent<VPDocAsideProps> {
  @Prop
  asideTop?: any
  @Prop
  asideBottom?: any
  @Prop
  asideOutlineBefore?: any
  @Prop
  asideOutlineAfter?: any
  @Prop
  asideAdsBefore?: any
  @Prop
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