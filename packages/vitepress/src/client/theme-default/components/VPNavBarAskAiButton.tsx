import { ActViewComponent, Component } from 'actview'
import '../extract-css/VPNavBarAskAiButton.scoped.css'
@Component({ name: 'VPNavBarAskAiButton' })
export class VPNavBarAskAiButton extends ActViewComponent {
  render() {
    return (
      <button type="button" class="VPNavBarAskAiButton">
        <span class="vpi-sparkles" aria-hidden="true" />
      </button>
    )
  }
}