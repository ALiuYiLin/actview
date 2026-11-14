import { ActViewComponent, Component } from 'actview'
import { useData } from '../composables/data'
import { VPFeatures } from './VPFeatures'

export class VPHomeFeatures extends ActViewComponent {
  render() {
    const { frontmatter } = useData()
    const features = frontmatter.value.features
    return features ? (
      <VPFeatures class="VPHomeFeatures" features={features} />
    ) : null
  }
}

Component({ name: 'VPHomeFeatures' })(VPHomeFeatures)
