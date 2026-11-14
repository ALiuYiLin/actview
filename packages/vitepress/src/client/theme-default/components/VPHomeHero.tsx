import { ActViewComponent, Component, Prop } from 'actview'
import { useData } from '../composables/data'
import { VPHero } from './VPHero'

export interface VPHomeHeroProps {
  homeHeroInfoBefore?: any
  homeHeroInfo?: any
  homeHeroInfoAfter?: any
  homeHeroActionsAfter?: any
  homeHeroActionsBeforeActions?: any
  homeHeroImage?: any
}

@Component({ name: 'VPHomeHero' })
export class VPHomeHero extends ActViewComponent<VPHomeHeroProps> {
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

  render() {
    const props = this.$props
    const { frontmatter } = useData()
    const hero = frontmatter.value.hero
    return hero ? (
      <VPHero
        class="VPHomeHero"
        name={hero.name}
        text={hero.text}
        tagline={hero.tagline}
        image={hero.image}
        actions={hero.actions}
        homeHeroInfoBefore={props.homeHeroInfoBefore}
        homeHeroInfo={props.homeHeroInfo}
        homeHeroInfoAfter={props.homeHeroInfoAfter}
        homeHeroActionsAfter={props.homeHeroActionsAfter}
        homeHeroActionsBeforeActions={props.homeHeroActionsBeforeActions}
        homeHeroImage={props.homeHeroImage}
      />
    ) : null
  }
}