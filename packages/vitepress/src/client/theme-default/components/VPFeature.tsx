import '../extract-css/VPFeature.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'
import { VPLink } from './VPLink'
import { VPImage, type ThemeableImage } from './VPImage'

export interface VPFeatureProps {
  icon?: string | ThemeableImage | { wrap?: boolean; alt?: string }
  title: string
  details?: string | string[]
  link?: string
  linkText?: string
  rel?: string
  target?: string
}

export class VPFeature extends ActViewComponent<VPFeatureProps> {
  icon?: VPFeatureProps['icon']
  title = ''
  details?: string | string[]
  link?: string
  linkText?: string
  rel?: string
  target?: string

  render() {
    const props = this.$props
    return (
      <VPLink
        class={['VPFeature', props.link ? 'link' : ''].filter(Boolean).join(' ')}
        href={props.link}
        rel={props.rel}
        target={props.target}
        noIcon
        tag={props.link ? 'a' : 'div'}
      >
        <article class="box">
          {typeof props.icon === 'object' && props.icon && 'wrap' in props.icon ? (
            <div class="icon">
              <VPImage
                image={props.icon as ThemeableImage}
                alt={(props.icon as { alt?: string }).alt}
                height={48}
                width={48}
              />
            </div>
          ) : typeof props.icon === 'object' && props.icon ? (
            <VPImage
              image={props.icon as ThemeableImage}
              alt={(props.icon as { alt?: string }).alt}
              height={48}
              width={48}
            />
          ) : props.icon ? (
            <div
              {...({ class: 'icon', innerHTML: String(props.icon) } as any)}
            />
          ) : null}
          <h2 class="title" {...({ innerHTML: props.title } as any)} />
          {Array.isArray(props.details) ? (
            <ul class="details">
              {props.details.map((item) => (
                <li key={item} {...({ innerHTML: item } as any)} />
              ))}
            </ul>
          ) : props.details ? (
            <p class="details" {...({ innerHTML: props.details } as any)} />
          ) : null}
          {props.linkText ? (
            <div class="link-text">
              <p class="link-text-value">
                {props.linkText} <span class="vpi-arrow-right link-text-icon" />
              </p>
            </div>
          ) : null}
        </article>
      </VPLink>
    )
  }
}

for (const key of [
  'icon',
  'title',
  'details',
  'link',
  'linkText',
  'rel',
  'target',
] as const) {
  Prop(VPFeature.prototype, key)
}
Component({ name: 'VPFeature' })(VPFeature)
