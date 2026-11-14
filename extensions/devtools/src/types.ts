// ============================================================
// DevTools panel 共享类型
// ============================================================

export type PanelTab = 'components' | 'events' | 'performance'

export interface AppRecord {
  id: number
  name: string
  rootId: number | null
}

export interface ComponentRecord {
  id: number
  appId: number
  name: string
  parentId: number | null
  childIds: number[]
  renderCount: number
  elTag: string | null
  elId: string | null
}

export interface EventRecord {
  seq: number
  type: string
  timestamp: number
  appId: number
  componentId?: number
  name?: string
  payload?: { key?: unknown; keyType?: string }
}

export interface PerformanceRecord {
  appId: number
  componentId: number
  name: string
  kind: string
  duration: number
  renderCount: number
  timestamp: number
}

export interface ModelSnapshot {
  token: string
  state: Record<string, unknown>
  computed: Record<string, unknown>
}

export interface StateSnapshot {
  id: number
  appId: number
  name: string
  props: Record<string, unknown>
  state: Record<string, unknown>
  computed: Record<string, unknown>
  models: ModelSnapshot[]
}
