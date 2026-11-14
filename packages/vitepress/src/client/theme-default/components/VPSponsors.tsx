import '../styles/components/vp-sponsor.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'
import { VPSponsorsGrid, type Sponsor } from './VPSponsorsGrid'

export interface Sponsors {
  tier?: string
  size?: any
  items: Sponsor[]
}

export interface VPSponsorsProps {
  mode?: 'normal' | 'aside'
  tier?: string
  size?: any
  data?: Sponsors[] | Sponsor[]
}

export class VPSponsors extends ActViewComponent<VPSponsorsProps> {
  mode?: 'normal' | 'aside'
  tier?: string
  size?: any
  data?: Sponsors[] | Sponsor[]

  render() {
    const props = this.$props
    const mode = props.mode ?? 'normal'
    const raw = props.data ?? []
    const groups: Sponsors[] = raw.length > 0 && 'items' in raw[0]
      ? (raw as Sponsors[])
      : [{ tier: props.tier, size: props.size, items: raw as Sponsor[] }]
    return (
      <div class={['VPSponsors vp-sponsor', mode].join(' ')}>
        {groups.map((sponsor, index) => (
          <section key={index} class="vp-sponsor-section">
            {sponsor.tier ? (
              <h3 class="vp-sponsor-tier">{sponsor.tier}</h3>
            ) : null}
            <VPSponsorsGrid size={sponsor.size} data={sponsor.items} />
          </section>
        ))}
      </div>
    )
  }
}

for (const key of ['mode', 'tier', 'size', 'data'] as const) {
  Prop(VPSponsors.prototype, key)
}
Component({ name: 'VPSponsors' })(VPSponsors)
