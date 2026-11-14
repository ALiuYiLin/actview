import { ActViewComponent, Component, Prop, Ref } from 'actview'
import { VPMenu } from './VPMenu'
import '../extract-css/VPFlyout.scoped.css'
export interface VPFlyoutProps {
  icon?: string
  button?: string
  label?: string
  items?: any[]
  children?: any
  class?: string
}

@Component({ name: 'VPFlyout' })
export class VPFlyout extends ActViewComponent<VPFlyoutProps> {
  @Prop
  icon?: string
  @Prop
  button?: string
  @Prop
  label?: string
  @Prop
  items?: any[]
  @Prop
  class?: string
  @Ref
  open = false

  render() {
    const props = this.$props
    return (
      <div
        class={['VPFlyout', props.class].filter(Boolean).join(' ')}
        onMouseEnter={() => (this.open = true)}
        onMouseLeave={() => (this.open = false)}
      >
        <button
          type="button"
          class="button"
          aria-haspopup="true"
          aria-expanded={this.open}
          aria-label={props.label}
          onClick={() => (this.open = !this.open)}
        >
          {props.button || props.icon ? (
            <span class="text">
              {props.icon ? (
                <span class={[props.icon, 'option-icon'].join(' ')} />
              ) : null}
              {props.button ? <span>{props.button}</span> : null}
              <span class="vpi-chevron-down text-icon" />
            </span>
          ) : (
            <span class="vpi-more-horizontal icon" />
          )}
        </button>
        <div class="menu">
          <VPMenu items={props.items}>{props.children}</VPMenu>
        </div>
      </div>
    )
  }
}