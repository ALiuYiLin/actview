import { ActViewComponent, Component, Dynamic, Prop } from 'actview'
import { useData } from '../composables/data'
import { VPHomeContent } from './VPHomeContent'
import { VPHomeFeatures } from './VPHomeFeatures'
import { VPHomeHero } from './VPHomeHero'
import '../extract-css/VPHome.scoped.css'
export interface VPHomeProps {
  content?: any
  homeHeroBefore?: any
  homeHeroInfoBefore?: any
  homeHeroInfo?: any
  homeHeroInfoAfter?: any
  homeHeroActionsAfter?: any
  homeHeroActionsBeforeActions?: any
  homeHeroImage?: any
  homeHeroAfter?: any
  homeFeaturesBefore?: any
  homeFeaturesAfter?: any
}

@Component({ name: 'VPHome' })
export class VPHome extends ActViewComponent<VPHomeProps> {
  @Prop
  content?: any
  @Prop
  homeHeroBefore?: any
  @Prop
  homeHeroInfoBefore?: any
  @Prop
  homeHeroInfo?: any
  @Prop
  homeHeroInfoAfter?: any
  @Prop
  homeHeroActionsAfter?: any
  @Prop
  homeHeroActionsBeforeActions?: any
  @Prop
  homeHeroImage?: any
  @Prop
  homeHeroAfter?: any
  @Prop
  homeFeaturesBefore?: any
  @Prop
  homeFeaturesAfter?: any

  render() {
    const props = this.$props
    const { frontmatter, theme } = useData()
    return (
      <div
        class={[
          'VPHome',
          theme.value.externalLinkIcon ? 'external-link-icon-enabled' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {props.homeHeroBefore}
        <VPHomeHero
          homeHeroInfoBefore={props.homeHeroInfoBefore}
          homeHeroInfo={props.homeHeroInfo}
          homeHeroInfoAfter={props.homeHeroInfoAfter}
          homeHeroActionsAfter={props.homeHeroActionsAfter}
          homeHeroActionsBeforeActions={props.homeHeroActionsBeforeActions}
          homeHeroImage={props.homeHeroImage}
        />
        {props.homeHeroAfter}
        {props.homeFeaturesBefore}
        <VPHomeFeatures />
        {props.homeFeaturesAfter}
        {frontmatter.value.markdownStyles !== false ? (
          <VPHomeContent>
            {props.content ? <Dynamic is={props.content} /> : null}
          </VPHomeContent>
        ) : props.content ? (
          <Dynamic is={props.content} />
        ) : null}
      </div>
    )
  }
}