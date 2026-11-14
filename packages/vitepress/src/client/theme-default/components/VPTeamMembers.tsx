import '../extract-css/VPTeamMembers.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'
import { VPTeamMembersItem } from './VPTeamMembersItem'

export interface VPTeamMembersProps {
  size?: 'small' | 'medium'
  members?: any[]
}

export class VPTeamMembers extends ActViewComponent<VPTeamMembersProps> {
  size?: 'small' | 'medium'
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

Prop(VPTeamMembers.prototype, 'size')
Prop(VPTeamMembers.prototype, 'members')
Component({ name: 'VPTeamMembers' })(VPTeamMembers)
