import { ActViewComponent, Component, Prop } from 'actview'
import { useLayout } from '../composables/layout'
import { VPNavBarAppearance } from './VPNavBarAppearance'
import { VPNavBarExtra } from './VPNavBarExtra'
import { VPNavBarHamburger } from './VPNavBarHamburger'
import { VPNavBarMenu } from './VPNavBarMenu'
import { VPNavBarSearch } from './VPNavBarSearch'
import { VPNavBarSocialLinks } from './VPNavBarSocialLinks'
import { VPNavBarTitle } from './VPNavBarTitle'
import { VPNavBarTranslations } from './VPNavBarTranslations'
import '../extract-css/VPNavBar.scoped.css'
export interface VPNavBarProps {
  isScreenOpen?: boolean
  onToggleScreen?: () => void
  navBarTitleBefore?: any
  navBarTitleAfter?: any
  navBarContentBefore?: any
  navBarContentAfter?: any
}

@Component({ name: 'VPNavBar' })
export class VPNavBar extends ActViewComponent<VPNavBarProps> {
  @Prop
  isScreenOpen?: boolean
  @Prop
  onToggleScreen?: () => void
  @Prop
  navBarTitleBefore?: any
  @Prop
  navBarTitleAfter?: any
  @Prop
  navBarContentBefore?: any
  @Prop
  navBarContentAfter?: any

  render() {
    const { isHome, hasSidebar } = useLayout()
    return (
      <div
        class={[
          'VPNavBar',
          hasSidebar.value ? 'has-sidebar' : '',
          isHome.value ? 'home' : '',
          'top',
          this.$props.isScreenOpen ? 'screen-open' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div class="wrapper">
          <div class="container">
            <div class="title">
              <VPNavBarTitle
                navBarTitleBefore={this.$props.navBarTitleBefore}
                navBarTitleAfter={this.$props.navBarTitleAfter}
              />
            </div>
            <div class="content">
              <div class="content-body">
                {this.$props.navBarContentBefore}
                <VPNavBarSearch class="search" />
                <VPNavBarMenu class="menu" />
                <VPNavBarTranslations class="translations" />
                <VPNavBarAppearance class="appearance" />
                <VPNavBarSocialLinks class="social-links" />
                <VPNavBarExtra class="extra" />
                {this.$props.navBarContentAfter}
                <VPNavBarHamburger
                  class="hamburger"
                  active={this.$props.isScreenOpen}
                  onclick={this.$props.onToggleScreen}
                />
              </div>
            </div>
          </div>
        </div>
        <div class="divider">
          <div class="divider-line" />
        </div>
      </div>
    )
  }
}