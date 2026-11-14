import { ActViewComponent, Component, Prop } from 'actview'
import { useData } from '../composables/data'
import { useNav } from '../composables/nav'
import { VPNavBar } from './VPNavBar'
import { VPNavScreen } from './VPNavScreen'
import '../extract-css/VPNav.scoped.css'
export interface VPNavProps {
  navBarTitleBefore?: any
  navBarTitleAfter?: any
  navBarContentBefore?: any
  navBarContentAfter?: any
  navScreenContentBefore?: any
  navScreenContentAfter?: any
}

@Component({ name: 'VPNav' })
export class VPNav extends ActViewComponent<VPNavProps> {
  @Prop
  navBarTitleBefore?: any
  @Prop
  navBarTitleAfter?: any
  @Prop
  navBarContentBefore?: any
  @Prop
  navBarContentAfter?: any
  @Prop
  navScreenContentBefore?: any
  @Prop
  navScreenContentAfter?: any

  render() {
    const { frontmatter } = useData()
    const { isScreenOpen, toggleScreen } = useNav()
    if (frontmatter.value.navbar === false) return null
    return (
      <header class="VPNav">
        <VPNavBar
          isScreenOpen={isScreenOpen.value}
          onToggleScreen={toggleScreen}
          navBarTitleBefore={this.$props.navBarTitleBefore}
          navBarTitleAfter={this.$props.navBarTitleAfter}
          navBarContentBefore={this.$props.navBarContentBefore}
          navBarContentAfter={this.$props.navBarContentAfter}
        />
        <VPNavScreen
          open={isScreenOpen.value}
          navScreenContentBefore={this.$props.navScreenContentBefore}
          navScreenContentAfter={this.$props.navScreenContentAfter}
        />
      </header>
    )
  }
}