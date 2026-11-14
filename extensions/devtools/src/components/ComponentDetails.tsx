// ============================================================
// 组件详情：props / state / computed / Model
// ============================================================

import { ActViewComponent, Component, Prop } from 'actview'
import { formatValue } from '../format'
import type { ComponentRecord, StateSnapshot } from '../types'

@Component({ name: 'ComponentDetails' })
export class ComponentDetails extends ActViewComponent {
  @Prop
  component: ComponentRecord | null = null

  @Prop
  state: StateSnapshot | null = null

  render() {
    const component = this.component
    if (!component) {
      return <div class="details empty">Select a component from the tree.</div>
    }

    const data = this.state
    return (
      <div class="details">
        <h2>{component.name || 'Anonymous'}</h2>
        <div class="meta">
          id {component.id} · app {component.appId} · renders{' '}
          {component.renderCount} · {component.elTag || 'no host'}
          {component.elId ? `#${component.elId}` : ''}
        </div>
        {!data ? (
          <div class="panel-hint">Loading state…</div>
        ) : (
          <>
            {this.renderValueSection('Props', data.props)}
            {this.renderValueSection('State', data.state)}
            {this.renderValueSection('Computed', data.computed)}
            <div class="section-title">
              Models ({data.models?.length ?? 0})
            </div>
            {!data.models || data.models.length === 0 ? (
              <div class="panel-hint">No @Model in this component.</div>
            ) : (
              data.models.map((model) => (
                <div class="model" key={model.token}>
                  <div class="model-head">{model.token}</div>
                  <pre class="value">
                    {formatValue({
                      state: model.state,
                      computed: model.computed,
                    })}
                  </pre>
                </div>
              ))
            )}
          </>
        )}
      </div>
    )
  }

  private renderValueSection(title: string, value: unknown) {
    return (
      <>
        <div class="section-title">{title}</div>
        <pre class="value">{formatValue(value)}</pre>
      </>
    )
  }
}
