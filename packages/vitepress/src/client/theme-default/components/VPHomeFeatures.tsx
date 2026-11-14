import { ActViewComponent, Component } from 'actview'
import { useData } from '../composables/data'
import { VPFeatures } from './VPFeatures'

@Component({ name: 'VPHomeFeatures' })
export class VPHomeFeatures extends ActViewComponent {
  render() {
    const { frontmatter } = useData()
    const features = frontmatter.value.features
    return features ? (
      <VPFeatures class="VPHomeFeatures" features={features} />
    ) : null
  }
}