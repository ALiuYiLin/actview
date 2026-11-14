import { ActViewComponent, Component, Prop } from 'actview'
import { VPCarbonAds } from './VPCarbonAds'

export interface VPDocAsideCarbonAdsProps {
  carbonAds?: any
}

export class VPDocAsideCarbonAds extends ActViewComponent<VPDocAsideCarbonAdsProps> {
  carbonAds?: any

  render() {
    return (
      <div class="VPDocAsideCarbonAds">
        <VPCarbonAds carbonAds={this.$props.carbonAds} />
      </div>
    )
  }
}

Prop(VPDocAsideCarbonAds.prototype, 'carbonAds')
Component({ name: 'VPDocAsideCarbonAds' })(VPDocAsideCarbonAds)
