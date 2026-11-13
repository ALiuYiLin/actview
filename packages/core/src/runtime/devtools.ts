// ============================================================
// @actview/core — DevTools 埋点协议
//
// core 只在关键节点发出事件；@actview/devtools 负责收集、建树、序列化。
// hook 未注册时所有 notify 直接返回，不构造 payload。
// ============================================================

import type { AppContext, ComponentInternalInstance } from './instance'

/** App 级事件 */
export interface DevtoolsAppInfo {
  appId: number
  name: string
  root: ComponentInternalInstance | null
}

/** 组件生命周期事件 */
export interface DevtoolsComponentInfo {
  appId: number
  id: number
  name: string
  instance: ComponentInternalInstance
  parent: ComponentInternalInstance | null
  el: Element | null
  renderCount: number
}

/** 响应式 track / trigger 事件 */
export interface DevtoolsReactiveEvent {
  appId: number
  componentId: number
  componentName: string
  target: any
  key: any
  type: string
  newValue?: any
  oldValue?: any
}

/** 渲染性能事件 */
export interface DevtoolsPerformanceEvent {
  appId: number
  componentId: number
  name: string
  kind: 'mount' | 'update'
  duration: number
  renderCount: number
  timestamp: number
}

export interface DevtoolsHook {
  onAppMount?: (info: DevtoolsAppInfo) => void
  onAppUnmount?: (info: DevtoolsAppInfo) => void
  onComponentMount?: (info: DevtoolsComponentInfo) => void
  onComponentUpdate?: (info: DevtoolsComponentInfo) => void
  onComponentUnmount?: (info: DevtoolsComponentInfo) => void
  onTrack?: (event: DevtoolsReactiveEvent) => void
  onTrigger?: (event: DevtoolsReactiveEvent) => void
  onPerformance?: (event: DevtoolsPerformanceEvent) => void
  /** 出现未捕获错误（可选；由错误处理链上报） */
  onError?: (error: unknown, info: string) => void
}

let hook: DevtoolsHook | null = null

/** 由 @actview/devtools 调用，注册收集逻辑；传 null 解除 */
export function setDevtoolsHook(h: DevtoolsHook | null): void {
  hook = h
}

export function getDevtoolsHook(): DevtoolsHook | null {
  return hook
}

/** App mount / unmount 上报 */
export function notifyDevtoolsApp(
  context: AppContext,
  event: 'mount' | 'unmount',
  root: ComponentInternalInstance | null,
): void {
  const h = hook
  if (!h) return
  const info: DevtoolsAppInfo = {
    appId: context.appId,
    name: context.name || 'Anonymous',
    root,
  }
  if (event === 'mount') h.onAppMount?.(info)
  else h.onAppUnmount?.(info)
}

/** 组件生命周期事件上报 */
export function notifyDevtoolsComponent(
  instance: ComponentInternalInstance,
  event: 'mount' | 'update' | 'unmount',
): void {
  const h = hook
  if (!h) return

  const info: DevtoolsComponentInfo = {
    appId: instance.appContext.appId,
    id: instance.uid,
    name: (instance.type.name as string | undefined) || 'Anonymous',
    instance,
    parent: instance.parent,
    el:
      instance.vnode.el && (instance.vnode.el as Node).nodeType === 1
        ? (instance.vnode.el as Element)
        : null,
    renderCount: instance.renderCount,
  }
  if (event === 'mount') h.onComponentMount?.(info)
  else if (event === 'update') h.onComponentUpdate?.(info)
  else h.onComponentUnmount?.(info)
}

/** 响应式 track / trigger 上报 */
export function notifyDevtoolsReactive(
  instance: ComponentInternalInstance,
  event: 'track' | 'trigger',
  payload: { target: any; key: any; type: string; newValue?: any; oldValue?: any },
): void {
  const h = hook
  if (!h) return
  const info: DevtoolsReactiveEvent = {
    appId: instance.appContext.appId,
    componentId: instance.uid,
    componentName: (instance.type.name as string | undefined) || 'Anonymous',
    target: payload.target,
    key: payload.key,
    type: payload.type,
    newValue: payload.newValue,
    oldValue: payload.oldValue,
  }
  if (event === 'track') h.onTrack?.(info)
  else h.onTrigger?.(info)
}

/** 渲染耗时上报 */
export function notifyDevtoolsPerformance(
  instance: ComponentInternalInstance,
  kind: 'mount' | 'update',
  duration: number,
): void {
  const h = hook
  if (!h) return
  h.onPerformance?.({
    appId: instance.appContext.appId,
    componentId: instance.uid,
    name: (instance.type.name as string | undefined) || 'Anonymous',
    kind,
    duration,
    renderCount: instance.renderCount,
    timestamp: Date.now(),
  })
}
