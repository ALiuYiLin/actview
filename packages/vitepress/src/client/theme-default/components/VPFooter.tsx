import { ActViewComponent, Component, Prop } from 'actview'
import { useData } from '../composables/data'
import '../extract-css/VPFooter.scoped.css'
export interface VPFooterProps {
  hasSidebar?: boolean
}

@Component({ name: 'VPFooter' })
export class VPFooter extends ActViewComponent<VPFooterProps> {
  @Prop
  hasSidebar?: boolean

  render() {
    const { theme, frontmatter } = useData()
    const footer = theme.value.footer
    if (!footer || frontmatter.value.footer === false) return null
    return (
      <footer
        class={['VPFooter', this.$props.hasSidebar ? 'has-sidebar' : '']
          .filter(Boolean)
          .join(' ')}
      >
        <div class="container">
          {footer.message ? <p class="message">{footer.message}</p> : null}
          {footer.copyright ? (
            <p class="copyright">{footer.copyright}</p>
          ) : null}
        </div>
      </footer>
    )
  }
}