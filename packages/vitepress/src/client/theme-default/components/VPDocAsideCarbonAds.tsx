import { ActViewComponent, Component, Prop } from 'actview'
import { VPCarbonAds } from './VPCarbonAds'

export interface VPDocAsideCarbonAdsProps {
  carbonAds?: any
}

@Component({ name: 'VPDocAsideCarbonAds' })
export class VPDocAsideCarbonAds extends ActViewComponent<VPDocAsideCarbonAdsProps> {
  @Prop
  carbonAds?: any

  render() {
    return (
      <div class="VPDocAsideCarbonAds">
        <VPCarbonAds carbonAds={this.$props.carbonAds} />
      </div>
    )
  }
}