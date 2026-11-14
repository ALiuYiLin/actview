import { ActViewComponent, Component, Prop } from 'actview'
import { VPSponsors } from './VPSponsors'
import { VPButton } from './VPButton'
import '../extract-css/VPHomeSponsors.scoped.css'
export interface VPHomeSponsorsProps {
  message?: string
  actionText?: string
  actionLink?: string
  data?: any[]
}

@Component({ name: 'VPHomeSponsors' })
export class VPHomeSponsors extends ActViewComponent<VPHomeSponsorsProps> {
  @Prop
  message?: string
  @Prop
  actionText?: string
  @Prop
  actionLink?: string
  @Prop
  data?: any[]

  render() {
    const props = this.$props
    return (
      <section class="VPHomeSponsors">
        <div class="container">
          <div class="header">
            <div class="love">
              <span class="vpi-heart icon" />
            </div>
            {props.message ? <h2 class="message">{props.message}</h2> : null}
          </div>
          <div class="sponsors">
            <VPSponsors mode="normal" data={props.data} />
          </div>
          {props.actionLink ? (
            <div class="action">
              <VPButton
                theme="sponsor"
                text={props.actionText ?? 'Become a sponsor'}
                href={props.actionLink}
              />
            </div>
          ) : null}
        </div>
      </section>
    )
  }
}