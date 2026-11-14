// ============================================================
// Events Tab
// ============================================================

import { ActViewComponent, Component, Prop } from 'actview'
import type { EventRecord } from '../types'

@Component({ name: 'EventsTab' })
export class EventsTab extends ActViewComponent {
  @Prop
  events: EventRecord[] = []

  render() {
    const events = this.events.slice(-200).reverse()
    return (
      <section class="tab-panel">
        <div class="panel-hint">
          Recent mount / update / track / trigger events.
        </div>
        <div class="table-wrap">
          {events.length === 0 ? (
            <div class="tree-empty">No events yet.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>time</th>
                  <th>type</th>
                  <th>component</th>
                  <th>key</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.seq}>
                    <td>{new Date(event.timestamp).toLocaleTimeString()}</td>
                    <td class={`event-${event.type}`}>{event.type}</td>
                    <td>
                      {event.name ||
                        (event.componentId != null
                          ? `#${event.componentId}`
                          : '—')}
                    </td>
                    <td>
                      {event.payload?.key == null
                        ? '—'
                        : String(event.payload.key)}
                    </td>
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
