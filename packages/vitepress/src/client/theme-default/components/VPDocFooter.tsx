import { ActViewComponent, Component, Prop } from 'actview'
import { useData } from '../composables/data'
import { VPDocFooterLastUpdated } from './VPDocFooterLastUpdated'
import '../extract-css/VPDocFooter.scoped.css'
export interface VPDocFooterProps {
  docFooterBefore?: any
}

@Component({ name: 'VPDocFooter' })
export class VPDocFooter extends ActViewComponent<VPDocFooterProps> {
  @Prop
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