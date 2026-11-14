import '../extract-css/VPDocFooter.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'
import { useData } from '../composables/data'
import { VPDocFooterLastUpdated } from './VPDocFooterLastUpdated'

export interface VPDocFooterProps {
  docFooterBefore?: any
}

export class VPDocFooter extends ActViewComponent<VPDocFooterProps> {
  docFooterBefore?: any

  render() {
    const { page } = useData()
    const hasLastUpdated = !!page.value.lastUpdated
    return (
      <footer class="VPDocFooter">
        {this.$props.docFooterBefore}
        {hasLastUpdated ? (
          <div class="edit-info">
            <div class="last-updated">
              <VPDocFooterLastUpdated />
            </div>
          </div>
        ) : null}
      </footer>
    )
  }
}

Prop(VPDocFooter.prototype, 'docFooterBefore')
Component({ name: 'VPDocFooter' })(VPDocFooter)
