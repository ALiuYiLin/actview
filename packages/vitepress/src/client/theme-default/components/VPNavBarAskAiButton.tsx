import '../extract-css/VPNavBarAskAiButton.css?scoped'
import { ActViewComponent, Component } from 'actview'

export class VPNavBarAskAiButton extends ActViewComponent {
  render() {
    return (
      <button type="button" class="VPNavBarAskAiButton">
        <span class="vpi-sparkles" aria-hidden="true" />
      </button>
    )
  }
}

Component({ name: 'VPNavBarAskAiButton' })(VPNavBarAskAiButton)
