import { ActViewComponent, Component, Ref } from 'actview'
import '../extract-css/VPLocalSearchBox.scoped.css'
@Component({ name: 'VPLocalSearchBox' })
export class VPLocalSearchBox extends ActViewComponent {
  @Ref
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