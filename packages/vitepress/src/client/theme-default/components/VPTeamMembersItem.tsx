import { ActViewComponent, Component, Prop } from 'actview'
import { VPLink } from './VPLink'
import { VPSocialLinks } from './VPSocialLinks'
import '../extract-css/VPTeamMembersItem.scoped.css'
export interface VPTeamMembersItemProps {
  size?: 'small' | 'medium'
  member: any
}

@Component({ name: 'VPTeamMembersItem' })
export class VPTeamMembersItem extends ActViewComponent<VPTeamMembersItemProps> {
  @Prop
  size?: 'small' | 'medium'
  @Prop
  member: any

  render() {
    const props = this.$props
    const member = props.member ?? {}
    const size = props.size ?? 'medium'
    return (
      <article class={['VPTeamMembersItem', size].join(' ')}>
        <div class="profile">
          <figure class="avatar">
            <img class="avatar-img" src={member.avatar} alt={member.name} />
          </figure>
          <div class="data">
            <h1 class="name">{member.name}</h1>
            {member.title || member.org ? (
              <p class="affiliation">
                {member.title ? <span class="title">{member.title}</span> : null}
                {member.title && member.org ? <span class="at"> @ </span> : null}
                {member.org ? (
                  <VPLink
                    class={['org', member.orgLink ? 'link' : ''].join(' ')}
                    href={member.orgLink}
                    noIcon
                  >
                    {member.org}
                  </VPLink>
                ) : null}
              </p>
            ) : null}
            {member.desc ? <p class="desc">{member.desc}</p> : null}
            {member.links ? (
              <div class="links">
                <VPSocialLinks links={member.links} me={false} />
              </div>
            ) : null}
          </div>
        </div>
        {member.sponsor ? (
          <div class="sp">
            <VPLink class="sp-link" href={member.sponsor} noIcon>
              <span class="vpi-heart sp-icon" />{' '}
              {member.actionText || 'Sponsor'}
            </VPLink>
          </div>
        ) : null}
      </article>
    )
  }
}