// ============================================================
// @actview/devtools — backend
//
// 接收 core DevtoolsHook 事件，维护 app / component 树、事件 ring buffer；
// 读组件状态（props/state/computed/Model）供扩展或后续 UI 使用。
// ============================================================

import {
  getComponentMeta,
  type DevtoolsAppInfo,
  type DevtoolsComponentInfo,
  type DevtoolsHook,
  type DevtoolsPerformanceEvent,
  type DevtoolsReactiveEvent,
} from '@actview/core'
import type {
  DevtoolsAppRecord,
  DevtoolsComponentRecord,
  DevtoolsComponentState,
  DevtoolsEventRecord,
  DevtoolsEventType,
  DevtoolsModelState,
  DevtoolsPerformanceRecord,
  DevtoolsSnapshot,
} from './types'

interface InternalComponentRecord extends DevtoolsComponentRecord {
  instance: any
}

interface ComponentLike {
  uid: number
  type: Function
  props: Record<string, any>
  ctx?: Record<string, any>
  modelScope?: any
  appContext: { appId: number }
}

export interface DevtoolsBackendOptions {
  maxEvents?: number
}

type SnapshotListener = (snapshot: DevtoolsSnapshot) => void

export class DevtoolsBackend {
  private readonly apps = new Map<number, DevtoolsAppRecord>()
  private readonly components = new Map<number, InternalComponentRecord>()
  private readonly listeners = new Set<SnapshotListener>()
  private readonly events: DevtoolsEventRecord[] = []
  private readonly performanceRecords: DevtoolsPerformanceRecord[] = []
  private readonly maxEvents: number
  private seq = 0

  readonly hook: DevtoolsHook = {
    onAppMount: (info) => this.onAppMount(info),
    onAppUnmount: (info) => this.onAppUnmount(info),
    onComponentMount: (info) => this.onComponentMount(info),
    onComponentUpdate: (info) => this.onComponentUpdate(info),
    onComponentUnmount: (info) => this.onComponentUnmount(info),
    onTrack: (event) => this.onReactive('track', event),
    onTrigger: (event) => this.onReactive('trigger', event),
    onPerformance: (event) => this.onPerformance(event),
  }

  constructor(options: DevtoolsBackendOptions = {}) {
    this.maxEvents = Math.max(10, options.maxEvents ?? 500)
  }

  get appCount(): number {
    return this.apps.size
  }

  /** 订阅快照；返回取消订阅函数。会立即回调一次。 */
  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener)
    listener(this.getSnapshot())
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot(): DevtoolsSnapshot {
    return {
      apps: [...this.apps.values()].map(cloneApp),
      components: [...this.components.values()].map(cloneComponent),
      events: this.events.map((event) => ({ ...event })),
      performance: this.performanceRecords.map((event) => ({ ...event })),
    }
  }

  /** 组件状态快照（props / 类实例 state / computed / Model） */
  getComponentState(id: number): DevtoolsComponentState | null {
    const record = this.components.get(id)
    if (!record) return null
    const instance = record.instance as ComponentLike
    const ctx = (instance.ctx ?? {}) as Record<string, unknown>
    const meta = getComponentMeta(instance.type)

    const state: Record<string, unknown> = {}
    for (const key of Object.keys(ctx)) {
      if (key.startsWith('$')) continue
      const value = readSafe(ctx, key)
      if (typeof value === 'function' || isHostNode(value)) continue
      state[key] = value
    }

    const computed: Record<string, unknown> = {}
    for (const key of meta.computed.keys()) {
      computed[key] = readSafe(ctx, key)
    }

    return {
      id: record.id,
      appId: record.appId,
      name: record.name,
      props: { ...instance.props },
      state,
      computed,
      models: readModels(instance),
    }
  }

  clear(): void {
    this.apps.clear()
    this.components.clear()
    this.events.length = 0
    this.performanceRecords.length = 0
    this.emit()
  }

  detachApp(appId: number): void {
    this.removeApp(appId)
    this.emit()
  }

  private onAppMount(info: DevtoolsAppInfo): void {
    const rootId = info.root?.uid ?? null
    const existing = this.apps.get(info.appId)
    if (existing) {
      existing.name = info.name
      existing.rootId = rootId
    } else {
      this.apps.set(info.appId, {
        id: info.appId,
        name: info.name,
        rootId,
        componentIds: rootId != null ? [rootId] : [],
        mountedAt: Date.now(),
      })
    }
    this.pushEvent('app-mount', info.appId, rootId ?? undefined, info.name)
    this.emit()
  }

  private onAppUnmount(info: DevtoolsAppInfo): void {
    this.removeApp(info.appId)
    this.pushEvent('app-unmount', info.appId, info.root?.uid, info.name)
    this.emit()
  }

  private onComponentMount(info: DevtoolsComponentInfo): void {
    const appId = info.appId
    this.ensureApp(appId)
    const parentId = info.parent?.uid ?? null
    const record: InternalComponentRecord = {
      id: info.id,
      appId,
      name: info.name,
      parentId,
      childIds: [],
      el: info.el,
      renderCount: info.renderCount,
      mountedAt: Date.now(),
      updatedAt: Date.now(),
      instance: info.instance,
    }
    this.components.set(info.id, record)

    const app = this.apps.get(appId)
    if (app && !app.componentIds.includes(info.id)) app.componentIds.push(info.id)

    if (parentId != null) {
      const parent = this.components.get(parentId)
      if (parent && !parent.childIds.includes(info.id)) {
        parent.childIds.push(info.id)
      }
    } else if (app) {
      app.rootId = info.id
    }

    // 子组件可能先于父组件 mount（父 render 期间挂载子树）：
    // 父记录后到时，把已存在的子组件补挂到父节点。
    for (const existing of this.components.values()) {
      if (existing.id !== record.id && existing.parentId === info.id) {
        if (!record.childIds.includes(existing.id)) {
          record.childIds.push(existing.id)
        }
      }
    }

    this.pushEvent('component-mount', appId, info.id, info.name, {
      parentId,
    })
    this.emit()
  }

  private onComponentUpdate(info: DevtoolsComponentInfo): void {
    const record = this.components.get(info.id)
    if (!record) return
    record.renderCount = info.renderCount
    record.el = info.el
    record.updatedAt = Date.now()
    this.pushEvent('component-update', info.appId, info.id, info.name, {
      renderCount: info.renderCount,
    })
    this.emit()
  }

  private onComponentUnmount(info: DevtoolsComponentInfo): void {
    const record = this.components.get(info.id)
    if (!record) return
    if (record.parentId != null) {
      const parent = this.components.get(record.parentId)
      if (parent) {
        parent.childIds = parent.childIds.filter((id) => id !== info.id)
      }
    }
    const app = this.apps.get(info.appId)
    if (app) {
      app.componentIds = app.componentIds.filter((id) => id !== info.id)
    }
    this.components.delete(info.id)
    this.pushEvent('component-unmount', info.appId, info.id, info.name)
    this.emit()
  }

  private onReactive(
    type: 'track' | 'trigger',
    event: DevtoolsReactiveEvent,
  ): void {
    this.pushEvent(type, event.appId, event.componentId, event.componentName, {
      target: event.target,
      key: event.key,
      keyType: event.type,
      newValue: event.newValue,
      oldValue: event.oldValue,
    })
    this.emit()
  }

  private onPerformance(event: DevtoolsPerformanceEvent): void {
    this.performanceRecords.push({ ...event })
    if (this.performanceRecords.length > this.maxEvents) {
      this.performanceRecords.shift()
    }
    this.pushEvent('performance', event.appId, event.componentId, event.name, {
      kind: event.kind,
      duration: event.duration,
      renderCount: event.renderCount,
    })
    this.emit()
  }

  private ensureApp(appId: number): void {
    if (this.apps.has(appId)) return
    this.apps.set(appId, {
      id: appId,
      name: 'Anonymous',
      rootId: null,
      componentIds: [],
      mountedAt: Date.now(),
    })
  }

  private removeApp(appId: number): void {
    this.apps.delete(appId)
    for (const [id, record] of this.components) {
      if (record.appId === appId) this.components.delete(id)
    }
  }

  private pushEvent(
    type: DevtoolsEventType,
    appId: number,
    componentId?: number,
    name?: string,
    payload?: Record<string, unknown>,
  ): void {
    this.events.push({
      seq: ++this.seq,
      type,
      timestamp: Date.now(),
      appId,
      componentId,
      name,
      payload,
    })
    if (this.events.length > this.maxEvents) this.events.shift()
  }

  private emit(): void {
    if (this.listeners.size === 0) return
    const snapshot = this.getSnapshot()
    for (const listener of [...this.listeners]) {
      try {
        listener(snapshot)
      } catch (err) {
        console.error('[actview] DevTools subscriber 出错：', err)
      }
    }
  }
}

function cloneApp(app: DevtoolsAppRecord): DevtoolsAppRecord {
  return { ...app, componentIds: [...app.componentIds] }
}

function cloneComponent(record: InternalComponentRecord): DevtoolsComponentRecord {
  return {
    id: record.id,
    appId: record.appId,
    name: record.name,
    parentId: record.parentId,
    childIds: [...record.childIds],
    el: record.el,
    renderCount: record.renderCount,
    mountedAt: record.mountedAt,
    updatedAt: record.updatedAt,
  }
}

function readSafe(target: Record<string, unknown>, key: string): unknown {
  try {
    return target[key]
  } catch {
    return '[getter error]'
  }
}

function isHostNode(value: unknown): boolean {
  return (
    typeof Node !== 'undefined' &&
    value instanceof Node
  )
}

function readModels(instance: ComponentLike): DevtoolsModelState[] {
  const scope = instance.modelScope as
    | { entries?: Map<Function, { data: Record<string, any>; meta: any }> }
    | undefined
  const entries = scope?.entries
  if (!entries) return []

  const models: DevtoolsModelState[] = []
  for (const [token, entry] of entries) {
    const state: Record<string, unknown> = {}
    const data = entry.data as Record<string, unknown>
    for (const key of Object.keys(data)) {
      if (key.startsWith('$')) continue
      const value = readSafe(data, key)
      if (typeof value === 'function' || isHostNode(value)) continue
      state[key] = value
    }
    const computed: Record<string, unknown> = {}
    for (const key of entry.meta?.computed?.keys?.() ?? []) {
      computed[key] = readSafe(data, key)
    }
    models.push({
      token: token.name || 'Anonymous',
      state,
      computed,
    })
  }
  return models
}
