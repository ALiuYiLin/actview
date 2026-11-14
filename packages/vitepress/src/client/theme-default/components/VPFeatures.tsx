import '../extract-css/VPFeatures.css?scoped'
import { ActViewComponent, Component, Prop } from 'actview'
import { VPFeature } from './VPFeature'

export interface VPFeaturesProps {
  features?: any[]
  class?: string
}

function getGrid(length: number): string {
  if (length === 2) return 'grid-2'
  if (length === 3) return 'grid-3'
  if (length % 3 === 0) return 'grid-6'
  if (length > 3) return 'grid-4'
  return ''
}

export class VPFeatures extends ActViewComponent<VPFeaturesProps> {
  features?: any[]
  class?: string

  render() {
    const features = this.$props.features
    if (!features) return null
    return (
      <div class={['VPFeatures', this.$props.class].filter(Boolean).join(' ')}>
        <div class="container">
          <div class="items">
            {features.map((feature) => (
              <div
                key={feature.title}
                class={['item', getGrid(features.length)]
                  .filter(Boolean)
                  .join(' ')}
              >
                <VPFeature
                  icon={feature.icon}
                  title={feature.title}
                  details={feature.details}
                  link={feature.link}
                  linkText={feature.linkText}
                  rel={feature.rel}
                  target={feature.target}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
}

Prop(VPFeatures.prototype, 'features')
Prop(VPFeatures.prototype, 'class')
Component({ name: 'VPFeatures' })(VPFeatures)
