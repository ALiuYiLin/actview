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
import './extract-css/Layout.scoped.css'
export interface LayoutProps {
  page?: any
  layoutTop?: any
  layoutBottom?: any
  [key: string]: any
}

@Component({ name: 'Layout' })
export class Layout extends ActViewComponent<LayoutProps> {
  @Prop
  page?: any
  @Prop
  layoutTop?: any
  @Prop
  layoutBottom?: any

  @Prop
  navBarTitleBefore: any = undefined

  @Prop
  navBarTitleAfter: any = undefined

  @Prop
  navBarContentBefore: any = undefined

  @Prop
  navBarContentAfter: any = undefined

  @Prop
  navScreenContentBefore: any = undefined

  @Prop
  navScreenContentAfter: any = undefined

  @Prop
  sidebarNavBefore: any = undefined

  @Prop
  sidebarNavAfter: any = undefined

  @Prop
  notFound: any = undefined

  @Prop
  pageTop: any = undefined

  @Prop
  pageBottom: any = undefined

  @Prop
  homeHeroBefore: any = undefined

  @Prop
  homeHeroInfoBefore: any = undefined

  @Prop
  homeHeroInfo: any = undefined

  @Prop
  homeHeroInfoAfter: any = undefined

  @Prop
  homeHeroActionsAfter: any = undefined

  @Prop
  homeHeroActionsBeforeActions: any = undefined

  @Prop
  homeHeroImage: any = undefined

  @Prop
  homeHeroAfter: any = undefined

  @Prop
  homeFeaturesBefore: any = undefined

  @Prop
  homeFeaturesAfter: any = undefined

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