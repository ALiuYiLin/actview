import '../extract-css/VPDocAsideOutline.css?scoped'
import { ActViewComponent, Component } from 'actview'
import { useData } from '../composables/data'
import { useLayout } from '../composables/layout'
import { VPDocOutlineItem } from './VPDocOutlineItem'

export class VPDocAsideOutline extends ActViewComponent {
  render() {
    const { theme } = useData()
    const { headers, hasLocalNav } = useLayout()
    return (
      <nav
        aria-labelledby="doc-outline-aria-label"
        class={['VPDocAsideOutline', hasLocalNav.value ? 'has-outline' : '']
          .filter(Boolean)
          .join(' ')}
      >
        <div class="content">
          <div class="outline-marker" />
          <div
            aria-level="2"
            class="outline-title"
            id="doc-outline-aria-label"
            role="heading"
          >
            {theme.value.outlineTitle ?? 'On this page'}
          </div>
          <VPDocOutlineItem headers={headers.value} root />
        </div>
      </nav>
    )
  }
}

Component({ name: 'VPDocAsideOutline' })(VPDocAsideOutline)
