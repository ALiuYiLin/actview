// ============================================================
// DevTools 埋点钩子 — core 暴露给 DevTools 的接入点
//   运行时（mountComponent / reactive-system）在关键节点调用 hook，
//   @actview/devtools 通过 setDevtoolsHook 注册收集逻辑。
//   本模块保持零依赖，不侵入框架主流程（hook 为空时无开销）。
// ============================================================

export interface DevtoolsComponentInfo {
  /** 实例唯一 id（自增） */
  id: number
  /** 组件名（defineComponent 存 name / Babel 保留函数名） */
  name: string
  /** 组件实例 */
  instance: any
  /** 父实例（根为 null） */
  parent: any
}

export interface DevtoolsHook {
  onComponentMount?: (info: DevtoolsComponentInfo) => void
  onComponentUpdate?: (info: DevtoolsComponentInfo) => void
  onComponentUnmount?: (info: DevtoolsComponentInfo) => void
  onTrack?: (e: { target: any; key: any }) => void
  onTrigger?: (e: { target: any; key: any }) => void
}

let hook: DevtoolsHook | null = null

/** 由 @actview/devtools 调用，注册收集逻辑；传 null 解除 */
export function setDevtoolsHook(h: DevtoolsHook | null): void {
  hook = h
}

export function getDevtoolsHook(): DevtoolsHook | null {
  return hook
}
