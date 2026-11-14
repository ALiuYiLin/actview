import '../extract-css/VPLocalNavOutlineDropdown.css?scoped'
import { ActViewComponent, Component, Ref } from 'actview'
import { useLayout } from '../composables/layout'
import { VPDocOutlineItem } from './VPDocOutlineItem'

export class VPLocalNavOutlineDropdown extends ActViewComponent {
  open = false

  render() {
    const { headers } = useLayout()
    return (
      <div class={['VPLocalNavOutlineDropdown', this.open ? 'open' : ''].join(' ')}>
        <button class="btn" onClick={() => (this.open = !this.open)}>
          On this page
          <span class="vpi-chevron-right icon" />
        </button>
        {this.open ? (
          <div class="items">
            <VPDocOutlineItem headers={headers.value} root />
          </div>
        ) : null}
      </div>
    )
  }
}

Ref(VPLocalNavOutlineDropdown.prototype, 'open')
Component({ name: 'VPLocalNavOutlineDropdown' })(VPLocalNavOutlineDropdown)
