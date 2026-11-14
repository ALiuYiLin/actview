import { ActViewComponent, Component, Prop } from 'actview'
import { VPSponsors } from './VPSponsors'

export interface VPDocAsideSponsorsProps {
  tier?: string
  size?: any
  data?: any
}

@Component({ name: 'VPDocAsideSponsors' })
export class VPDocAsideSponsors extends ActViewComponent<VPDocAsideSponsorsProps> {
  @Prop
  tier?: string
  @Prop
  size?: any
  @Prop
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