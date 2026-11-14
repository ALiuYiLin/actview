import { ActViewComponent, Component, Dynamic, Prop, Ref } from 'actview'
import { VPNavScreenMenuGroupLink } from './VPNavScreenMenuGroupLink'
import { VPNavScreenMenuGroupSection } from './VPNavScreenMenuGroupSection'
import '../extract-css/VPNavScreenMenuGroup.scoped.css'
export interface VPNavScreenMenuGroupProps {
  text?: string
  items?: any[]
}

@Component({ name: 'VPNavScreenMenuGroup' })
export class VPNavScreenMenuGroup extends ActViewComponent<VPNavScreenMenuGroupProps> {
  @Prop
  text?: string
  @Prop
  items?: any[]
  @Ref
  isOpen = false

  render() {
    const props = this.$props
    const groupId = `NavScreenGroup-${(props.text ?? '').replace(' ', '-').toLowerCase()}`
    return (
      <div class={['VPNavScreenMenuGroup', this.isOpen ? 'open' : ''].join(' ')}>
        <button
          class="button"
          aria-controls={groupId}
          aria-expanded={this.isOpen}
          onClick={() => (this.isOpen = !this.isOpen)}
        >
          <span class="button-text">{props.text}</span>
          <span class="vpi-plus button-icon" />
        </button>
        <div id={groupId} class="items">
          {(props.items ?? []).map((item) => {
            const key = JSON.stringify(item)
            if ('link' in item) {
              return (
                <div key={key} class="item">
                  <VPNavScreenMenuGroupLink item={item} />
                </div>
              )
            }
            if ('component' in item) {
              return (
                <div key={key} class="item">
                  <Dynamic is={item.component} {...(item.props ?? {})} screen-menu />
                </div>
              )
            }
            return (
              <div key={key} class="group">
                <VPNavScreenMenuGroupSection
                  text={item.text}
                  items={item.items}
                />
              </div>
            )
          })}
        </div>
      </div>
    )
  }
}