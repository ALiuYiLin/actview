// ============================================================
// @actview/devtools — 后端数据模型
// ============================================================

export interface DevtoolsAppRecord {
  id: number
  name: string
  rootId: number | null
  componentIds: number[]
  mountedAt: number
}

export interface DevtoolsComponentRecord {
  id: number
  appId: number
  name: string
  parentId: number | null
  childIds: number[]
  el: Element | null
  renderCount: number
  mountedAt: number
  updatedAt: number
}

export type DevtoolsEventType =
  | 'app-mount'
  | 'app-unmount'
  | 'component-mount'
  | 'component-update'
  | 'component-unmount'
  | 'track'
  | 'trigger'
  | 'performance'

export interface DevtoolsEventRecord {
  seq: number
  type: DevtoolsEventType
  timestamp: number
  appId: number
  componentId?: number
  name?: string
  payload?: Record<string, unknown>
}

export interface DevtoolsPerformanceRecord {
  appId: number
  componentId: number
  name: string
  kind: 'mount' | 'update'
  duration: number
  renderCount: number
  timestamp: number
}

export interface DevtoolsSnapshot {
  apps: DevtoolsAppRecord[]
  components: DevtoolsComponentRecord[]
  events: DevtoolsEventRecord[]
  performance: DevtoolsPerformanceRecord[]
}

export interface DevtoolsModelState {
  token: string
  state: Record<string, unknown>
  computed: Record<string, unknown>
}

export interface DevtoolsComponentState {
  id: number
  appId: number
  name: string
  props: Record<string, unknown>
  state: Record<string, unknown>
  computed: Record<string, unknown>
  models: DevtoolsModelState[]
}
