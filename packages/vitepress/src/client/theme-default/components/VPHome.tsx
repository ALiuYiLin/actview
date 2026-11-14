import '../extract-css/VPHome.css?scoped'
import { ActViewComponent, Component, Dynamic, Prop } from 'actview'
import { useData } from '../composables/data'
import { VPHomeContent } from './VPHomeContent'
import { VPHomeFeatures } from './VPHomeFeatures'
import { VPHomeHero } from './VPHomeHero'

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

export class VPHome extends ActViewComponent<VPHomeProps> {
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

for (const key of [
  'content',
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
  Prop(VPHome.prototype, key)
}
Component({ name: 'VPHome' })(VPHome)
