import { ActViewComponent, Component, Prop } from 'actview'
import '../extract-css/VPCarbonAds.scoped.css'
export interface VPCarbonAdsProps {
  carbonAds?: any
}

@Component({ name: 'VPCarbonAds' })
export class VPCarbonAds extends ActViewComponent<VPCarbonAdsProps> {
  @Prop
  carbonAds?: any

  render() {
    if (!this.$props.carbonAds) return null
    return <div class="VPCarbonAds" />
  }
}