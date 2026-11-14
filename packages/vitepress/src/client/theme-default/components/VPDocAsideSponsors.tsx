import { ActViewComponent, Component, Prop } from 'actview'
import { VPSponsors } from './VPSponsors'

export interface VPDocAsideSponsorsProps {
  tier?: string
  size?: any
  data?: any
}

export class VPDocAsideSponsors extends ActViewComponent<VPDocAsideSponsorsProps> {
  tier?: string
  size?: any
  data?: any

  render() {
    return (
      <div class="VPDocAsideSponsors">
        <VPSponsors
          mode="aside"
          tier={this.$props.tier}
          size={this.$props.size}
          data={this.$props.data}
        />
      </div>
    )
  }
}

Prop(VPDocAsideSponsors.prototype, 'tier')
Prop(VPDocAsideSponsors.prototype, 'size')
Prop(VPDocAsideSponsors.prototype, 'data')
Component({ name: 'VPDocAsideSponsors' })(VPDocAsideSponsors)
