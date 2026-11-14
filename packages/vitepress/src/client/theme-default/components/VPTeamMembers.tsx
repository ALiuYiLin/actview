import { ActViewComponent, Component, Prop } from 'actview'
import { VPTeamMembersItem } from './VPTeamMembersItem'
import '../extract-css/VPTeamMembers.scoped.css'
export interface VPTeamMembersProps {
  size?: 'small' | 'medium'
  members?: any[]
}

@Component({ name: 'VPTeamMembers' })
export class VPTeamMembers extends ActViewComponent<VPTeamMembersProps> {
  @Prop
  size?: 'small' | 'medium'
  @Prop
  members?: any[]

  render() {
    const props = this.$props
    const size = props.size ?? 'medium'
    const members = props.members ?? []
    return (
      <div class={['VPTeamMembers', size, `count-${members.length}`].join(' ')}>
        <div class="container">
          {members.map((member) => (
            <div key={member.name} class="item">
              <VPTeamMembersItem size={size} member={member} />
            </div>
          ))}
        </div>
      </div>
    )
  }
}