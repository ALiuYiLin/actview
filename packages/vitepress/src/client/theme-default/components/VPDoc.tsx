import { ActViewComponent, Component, Dynamic, Prop } from 'actview'
import { useData } from '../composables/data'
import { useLayout } from '../composables/layout'
import { route } from '../composables/route'
import { VPDocAside } from './VPDocAside'
import { VPDocFooter } from './VPDocFooter'
import '../extract-css/VPDoc.scoped.css'
export interface VPDocProps {
  content?: any
  docTop?: any
  docBottom?: any
  docFooterBefore?: any
  docBefore?: any
  docAfter?: any
  asideTop?: any
  asideBottom?: any
  asideOutlineBefore?: any
  asideOutlineAfter?: any
  asideAdsBefore?: any
  asideAdsAfter?: any
}

@Component({ name: 'VPDoc' })
export class VPDoc extends ActViewComponent<VPDocProps> {
  @Prop
  content?: any
  @Prop
  docTop?: any
  @Prop
  docBottom?: any
  @Prop
  docFooterBefore?: any
  @Prop
  docBefore?: any
  @Prop
  docAfter?: any
  @Prop
  asideTop?: any
  @Prop
  asideBottom?: any
  @Prop
  asideOutlineBefore?: any
  @Prop
  asideOutlineAfter?: any
  @Prop
  asideAdsBefore?: any
  @Prop
  asideAdsAfter?: any

  render() {
    const props = this.$props
    const { theme } = useData()
    const { hasSidebar, hasAside, leftAside } = useLayout()
    const pageName = route.value.path
      .replace(/[./]+/g, '_')
      .replace(/_html$/, '')
    return (
      <div
        class={[
          'VPDoc',
          hasSidebar.value ? 'has-sidebar' : '',
          hasAside.value ? 'has-aside' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {props.docTop}
        <div class="container">
          {hasAside.value ? (
            <div
              class={['aside', leftAside.value ? 'left-aside' : '']
                .filter(Boolean)
                .join(' ')}
            >
              <div class="aside-curtain" />
              <div class="aside-container">
                <div class="aside-content">
                  <VPDocAside
                    asideTop={props.asideTop}
                    asideBottom={props.asideBottom}
                    asideOutlineBefore={props.asideOutlineBefore}
                    asideOutlineAfter={props.asideOutlineAfter}
                    asideAdsBefore={props.asideAdsBefore}
                    asideAdsAfter={props.asideAdsAfter}
                  />
                </div>
              </div>
            </div>
          ) : null}
          <div class="content">
            <div class="content-container">
              {props.docBefore}
              <main class="main">
                {props.content ? (
                  <div
                    class={[
                      'vp-doc',
                      pageName,
                      theme.value.externalLinkIcon
                        ? 'external-link-icon-enabled'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <Dynamic is={props.content} />
                  </div>
                ) : null}
              </main>
              <VPDocFooter docFooterBefore={props.docFooterBefore} />
              {props.docAfter}
            </div>
          </div>
        </div>
        {props.docBottom}
      </div>
    )
  }
}