// ============================================================
// 组件树（递归渲染）
// ============================================================

import { ActViewComponent, Component, Prop } from 'actview'
import type { ComponentRecord } from '../types'

@Component({ name: 'ComponentTree' })
export class ComponentTree extends ActViewComponent {
  @Prop
  components: ComponentRecord[] = []

  @Prop
  appId: number | null = null

  @Prop
  selectedId: number | null = null

  @Prop
  connected = false

  @Prop
  onComponentSelect: (id: number) => void = () => {}

  render() {
    const components = this.appId == null
      ? []
      : this.components.filter((component) => component.appId === this.appId)

    if (components.length === 0) {
      return (
        <div class="tree-empty">
          {this.connected
            ? 'No components captured.'
            : 'Waiting for @actview/devtools…'}
        </div>
      )
    }

    const ids = new Set(components.map((component) => component.id))
    const roots = components.filter(
      (component) =>
        component.parentId == null || !ids.has(component.parentId),
    )
    const rendered = new Set<number>()

    const walk = (component: ComponentRecord, depth: number): any[] => {
      if (rendered.has(component.id)) return []
      rendered.add(component.id)
      const children = components.filter(
        (child) => child.parentId === component.id,
      )
      const row = (
        <div
          key={component.id}
          class={`tree-node${component.id === this.selectedId ? ' selected' : ''}`}
          style={{ paddingLeft: `${10 + depth * 14}px` }}
          onClick={() => this.onComponentSelect(component.id)}
        >
          <span class="caret">{children.length > 0 ? '▾' : '·'}</span>
          <span class="name">{component.name || 'Anonymous'}</span>
          <span class="badge" title="render count">
            {component.renderCount ?? 0}
          </span>
        </div>
      )
      return [row, ...children.flatMap((child) => walk(child, depth + 1))]
    }

    return <>{roots.flatMap((root) => walk(root, 0))}</>
  }
}
