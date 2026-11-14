import { ActViewComponent, Component, Prop } from 'actview'
import { useData } from '../composables/data'
import { useLangs } from '../composables/langs'
import { useLayout } from '../composables/layout'
import { VPImage } from './VPImage'
import '../extract-css/VPNavBarTitle.scoped.css'
export interface VPNavBarTitleProps {
  navBarTitleBefore?: any
  navBarTitleAfter?: any
}

@Component({ name: 'VPNavBarTitle' })
export class VPNavBarTitle extends ActViewComponent<VPNavBarTitleProps> {
  @Prop
  navBarTitleBefore?: any
  @Prop
  navBarTitleAfter?: any

  render() {
    const { site, theme } = useData()
    const { hasSidebar } = useLayout()
    const { currentLang } = useLangs()
    const logoLink = theme.value.logoLink
    const link = typeof logoLink === 'string' ? logoLink : logoLink?.link
    const logo = theme.value.logo
    const siteTitle = theme.value.siteTitle
    return (
      <div
        class={['VPNavBarTitle', hasSidebar.value ? 'has-sidebar' : ''].join(' ')}
      >
        <a
          class="title"
          href={link ?? currentLang.value.link}
          rel={typeof logoLink === 'string' ? undefined : logoLink?.rel}
          target={typeof logoLink === 'string' ? undefined : logoLink?.target}
        >
          {this.$props.navBarTitleBefore}
          {logo ? <VPImage class="logo" image={logo} /> : null}
          <span>{siteTitle != null ? siteTitle : site.value.title}</span>
          {this.$props.navBarTitleAfter}
        </a>
      </div>
    )
  }
}