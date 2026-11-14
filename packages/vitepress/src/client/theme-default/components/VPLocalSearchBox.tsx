import '../extract-css/VPLocalSearchBox.css?scoped'
import { ActViewComponent, Component, Ref } from 'actview'

export class VPLocalSearchBox extends ActViewComponent {
  open = false

  render() {
    if (!this.open) return null
    return (
      <div class="VPLocalSearchBox">
        <div class="backdrop" onClick={() => (this.open = false)} />
        <div class="shell">
          <input class="search-input" placeholder="Search" />
          <button class="cancel" onClick={() => (this.open = false)}>
            Cancel
          </button>
        </div>
      </div>
    )
  }
}

Ref(VPLocalSearchBox.prototype, 'open')
Component({ name: 'VPLocalSearchBox' })(VPLocalSearchBox)
