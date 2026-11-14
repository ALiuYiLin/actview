import './extract-css/Layout.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'
import { useData } from './composables/data'
import { useLayout } from './composables/layout'
import { useSidebarControl } from './composables/sidebar'
import { VPBackdrop } from './components/VPBackdrop'
import { VPContent } from './components/VPContent'
import { VPFooter } from './components/VPFooter'
import { VPLocalNav } from './components/VPLocalNav'
import { VPNav } from './components/VPNav'
import { VPSidebar } from './components/VPSidebar'
import { VPSkipLink } from './components/VPSkipLink'

export interface LayoutProps {
  page?: any
  layoutTop?: any
  layoutBottom?: any
  [key: string]: any
}

export class Layout extends ActViewComponent<LayoutProps> {
  page?: any
  layoutTop?: any
  layoutBottom?: any

  render() {
    const { frontmatter } = useData()
    const { hasSidebar } = useLayout()
    const { isOpen, open, close } = useSidebarControl()
    if (frontmatter.value.layout === false) {
      return <VPContent content={this.$props.page} />
    }
    return (
      <div class={['Layout', frontmatter.value.pageClass].filter(Boolean).join(' ')}>
        {this.$props.layoutTop}
        <VPSkipLink label={undefined} />
        <VPBackdrop
          class="backdrop"
          show={isOpen.value}
          onclick={close}
        />
        <VPNav
          navBarTitleBefore={this.$props.navBarTitleBefore}
          navBarTitleAfter={this.$props.navBarTitleAfter}
          navBarContentBefore={this.$props.navBarContentBefore}
          navBarContentAfter={this.$props.navBarContentAfter}
          navScreenContentBefore={this.$props.navScreenContentBefore}
          navScreenContentAfter={this.$props.navScreenContentAfter}
        />
        <VPLocalNav open={isOpen.value} onOpenMenu={open} />
        <VPSidebar
          open={isOpen.value}
          sidebarNavBefore={this.$props.sidebarNavBefore}
          sidebarNavAfter={this.$props.sidebarNavAfter}
        />
        <VPContent
          content={this.$props.page}
          notFound={this.$props.notFound}
          pageTop={this.$props.pageTop}
          pageBottom={this.$props.pageBottom}
          homeHeroBefore={this.$props.homeHeroBefore}
          homeHeroInfoBefore={this.$props.homeHeroInfoBefore}
          homeHeroInfo={this.$props.homeHeroInfo}
          homeHeroInfoAfter={this.$props.homeHeroInfoAfter}
          homeHeroActionsAfter={this.$props.homeHeroActionsAfter}
          homeHeroActionsBeforeActions={this.$props.homeHeroActionsBeforeActions}
          homeHeroImage={this.$props.homeHeroImage}
          homeHeroAfter={this.$props.homeHeroAfter}
          homeFeaturesBefore={this.$props.homeFeaturesBefore}
          homeFeaturesAfter={this.$props.homeFeaturesAfter}
        />
        {this.$props.layoutBottom}
        <VPFooter hasSidebar={hasSidebar.value} />
      </div>
    )
  }
}

for (const key of [
  'page',
  'layoutTop',
  'layoutBottom',
  'navBarTitleBefore',
  'navBarTitleAfter',
  'navBarContentBefore',
  'navBarContentAfter',
  'navScreenContentBefore',
  'navScreenContentAfter',
  'sidebarNavBefore',
  'sidebarNavAfter',
  'notFound',
  'pageTop',
  'pageBottom',
  'homeHeroBefore',
  'homeHeroInfoBefore',
  'homeHeroInfo',
  'homeHeroInfoAfter',
  'homeHeroActionsAfter',
  'homeHeroActionsBeforeActions',
  'homeHeroImage',
  'homeHeroAfter',
  'homeFeaturesBefore',
  'homeFeaturesAfter',
] as const) {
  Prop(Layout.prototype, key)
}
Component({ name: 'Layout' })(Layout)
