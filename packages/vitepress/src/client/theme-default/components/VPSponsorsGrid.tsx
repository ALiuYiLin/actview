import { ActViewComponent, Component, Prop } from 'actview'

export interface Sponsor {
  name: string
  img: string
  url: string
}

export interface VPSponsorsGridProps {
  size?: 'xmini' | 'mini' | 'small' | 'medium' | 'big'
  data?: Sponsor[]
}

export class VPSponsorsGrid extends ActViewComponent<VPSponsorsGridProps> {
  size?: VPSponsorsGridProps['size']
  data?: Sponsor[]

  render() {
    const props = this.$props
    const size = props.size ?? 'medium'
    return (
      <div class={['VPSponsorsGrid vp-sponsor-grid', size].join(' ')}>
        {(props.data ?? []).map((sponsor) => (
          <div key={sponsor.name} class="vp-sponsor-grid-item">
            <a
              class="vp-sponsor-grid-link"
              href={sponsor.url}
              target="_blank"
              rel="sponsored noopener"
            >
              <article class="vp-sponsor-grid-box">
                <img
                  class="vp-sponsor-grid-image"
                  src={sponsor.img}
                  alt={sponsor.name}
                />
              </article>
            </a>
          </div>
        ))}
      </div>
    )
  }
}

Prop(VPSponsorsGrid.prototype, 'size')
Prop(VPSponsorsGrid.prototype, 'data')
Component({ name: 'VPSponsorsGrid' })(VPSponsorsGrid)
