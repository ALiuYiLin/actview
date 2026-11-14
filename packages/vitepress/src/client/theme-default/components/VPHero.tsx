import { ActViewComponent, Component, Prop } from 'actview'
import { VPButton } from './VPButton'
import { VPImage, type ThemeableImage } from './VPImage'
import '../extract-css/VPHero.scoped.css'
export interface VPHeroProps {
  name?: string
  text?: string
  tagline?: string
  image?: ThemeableImage
  actions?: any[]
  class?: string
  homeHeroInfoBefore?: any
  homeHeroInfo?: any
  homeHeroInfoAfter?: any
  homeHeroActionsBeforeActions?: any
  homeHeroImage?: any
  homeHeroActionsAfter?: any
}

@Component({ name: 'VPHero' })
export class VPHero extends ActViewComponent<VPHeroProps> {
  @Prop
  name?: string
  @Prop
  text?: string
  @Prop
  tagline?: string
  @Prop
  image?: ThemeableImage
  @Prop
  actions?: any[]
  @Prop
  class?: string
  @Prop
  homeHeroInfoBefore?: any
  @Prop
  homeHeroInfo?: any
  @Prop
  homeHeroInfoAfter?: any
  @Prop
  homeHeroActionsBeforeActions?: any
  @Prop
  homeHeroImage?: any
  @Prop
  homeHeroActionsAfter?: any

  render() {
    const props = this.$props
    const hasImage = !!(props.image || props.homeHeroImage)
    return (
      <div
        class={['VPHero', hasImage ? 'has-image' : '', props.class]
          .filter(Boolean)
          .join(' ')}
      >
        <div class="container">
          <div class="main">
            {props.homeHeroInfoBefore}
            {props.homeHeroInfo ?? (
              <>
                <h1 class="heading">
                  {props.name ? (
                    <span class="name clip">{props.name}</span>
                  ) : null}
                  {props.text ? <span class="text">{props.text}</span> : null}
                </h1>
                {props.tagline ? <p class="tagline">{props.tagline}</p> : null}
              </>
            )}
            {props.homeHeroInfoAfter}
            {props.actions ? (
              <div class="actions">
                {props.homeHeroActionsBeforeActions}
                {props.actions.map((action) => (
                  <div key={action.link} class="action">
                    <VPButton
                      tag="a"
                      size="medium"
                      theme={action.theme}
                      text={action.text}
                      href={action.link}
                      target={action.target}
                      rel={action.rel}
                    />
                  </div>
                ))}
              </div>
            ) : null}
            {props.homeHeroActionsAfter}
          </div>
          {hasImage ? (
            <div class="image">
              <div class="image-container">
                <div class="image-bg" />
                {props.homeHeroImage ??
                  (props.image ? (
                    <VPImage class="image-src" image={props.image} />
                  ) : null)}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    )
  }
}