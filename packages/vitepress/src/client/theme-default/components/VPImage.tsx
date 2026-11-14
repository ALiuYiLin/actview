import '../extract-css/VPImage.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'

export interface VPImageSource {
  src: string
  alt?: string
  width?: number
  height?: number
}

export type ThemeableImage =
  | string
  | VPImageSource
  | { light: string | VPImageSource; dark: string | VPImageSource; alt?: string }

export interface VPImageProps {
  image?: ThemeableImage
  alt?: string
  class?: string
  width?: number | string
  height?: number | string
}

function resolveSrc(image: string | VPImageSource): string {
  return typeof image === 'string' ? image : image.src
}

export class VPImage extends ActViewComponent<VPImageProps> {
  image?: ThemeableImage
  alt?: string
  class?: string
  width?: number | string
  height?: number | string

  render() {
    const props = this.$props
    const image = props.image
    if (!image) return null

    if (typeof image === 'string' || 'src' in image) {
      const source = image as string | VPImageSource
      return (
        <img
          class={['VPImage', props.class].filter(Boolean).join(' ')}
          src={resolveSrc(source)}
          alt={props.alt ?? (typeof image === 'string' ? '' : image.alt || '')}
          width={props.width}
          height={props.height}
        />
      )
    }

    return (
      <>
        <VPImage
          class="dark"
          image={image.dark}
          alt={props.alt ?? image.alt}
          width={props.width}
          height={props.height}
        />
        <VPImage
          class="light"
          image={image.light}
          alt={props.alt ?? image.alt}
          width={props.width}
          height={props.height}
        />
      </>
    )
  }
}

for (const key of ['image', 'alt', 'class', 'width', 'height'] as const) {
  Prop(VPImage.prototype, key)
}
Component({ name: 'VPImage' })(VPImage)
