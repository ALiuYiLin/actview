// ============================================================
// Performance Tab
// ============================================================

import { ActViewComponent, Component, Prop } from 'actview'
import type { PerformanceRecord } from '../types'

@Component({ name: 'PerformanceTab' })
export class PerformanceTab extends ActViewComponent {
  @Prop
  records: PerformanceRecord[] = []

  render() {
    const records = this.records
      .slice()
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 200)

    return (
      <section class="tab-panel">
        <div class="panel-hint">Render duration (mount / update).</div>
        <div class="table-wrap">
          {records.length === 0 ? (
            <div class="tree-empty">
              No performance records. Set app.config.performance = true.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>component</th>
                  <th>kind</th>
                  <th>duration</th>
                  <th>renders</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={`${record.componentId}-${record.timestamp}`}>
                    <td>{record.name || `#${record.componentId}`}</td>
                    <td>{record.kind}</td>
                    <td>{record.duration.toFixed(2)} ms</td>
                    <td>{record.renderCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    )
  }
}
