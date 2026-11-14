import '../extract-css/VPCarbonAds.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'

export interface VPCarbonAdsProps {
  carbonAds?: any
}

export class VPCarbonAds extends ActViewComponent<VPCarbonAdsProps> {
  carbonAds?: any

  render() {
    if (!this.$props.carbonAds) return null
    return <div class="VPCarbonAds" />
  }
}

Prop(VPCarbonAds.prototype, 'carbonAds')
Component({ name: 'VPCarbonAds' })(VPCarbonAds)
