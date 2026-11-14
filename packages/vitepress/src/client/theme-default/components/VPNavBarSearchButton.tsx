import '../extract-css/VPNavBarSearchButton.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'

export interface VPNavBarSearchButtonProps {
  text?: string
  class?: string
  onclick?: () => void
}

export class VPNavBarSearchButton extends ActViewComponent<VPNavBarSearchButtonProps> {
  text?: string
  onclick?: () => void

  render() {
    return (
      <button
        type="button"
        class={['VPNavBarSearchButton', this.$props.class].filter(Boolean).join(' ')}
        onClick={() => this.$props.onclick?.()}
      >
        <span class="vpi-search" aria-hidden="true" />
        <span class="text">{this.$props.text}</span>
        <span class="keys" aria-hidden="true">
          <kbd class="key-cmd">⌘</kbd>
          <kbd class="key-ctrl">Ctrl</kbd>
          <kbd>K</kbd>
        </span>
      </button>
    )
  }
}

Prop(VPNavBarSearchButton.prototype, 'text')
Prop(VPNavBarSearchButton.prototype, 'class')
Prop(VPNavBarSearchButton.prototype, 'onclick')
Component({ name: 'VPNavBarSearchButton' })(VPNavBarSearchButton)
