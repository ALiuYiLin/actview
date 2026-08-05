import type { ComponentInstance } from "./mountComponent"

// ============================================================
// 生命周期钩子 — 模块级 currentInstance 上下文
//   onMounted / onUpdated / onBeforeUnmount 只能在组件 setup 中调用
//   （setup 执行期间 currentInstance 指向该组件实例）
//   setCurrentInstance 同时激活/恢复组件的 effect scope：
//   setup 期间创建的 watch/computed 注册进组件 scope，卸载时自动停止
// ============================================================

let currentInstance: ComponentInstance | null = null

export function getCurrentInstance(): ComponentInstance | null {
  return currentInstance
}

export function setCurrentInstance(instance: ComponentInstance | null) {
  // 离开上一个实例：恢复其 scope 的上游
  if (currentInstance) currentInstance.scope?.off()
  currentInstance = instance
  // 进入新实例：激活其 scope
  instance?.scope?.on()
}

type HookType = 'mounted' | 'updated' | 'beforeUnmount' | 'unmounted'

export function onMounted(fn: () => void) {
  registerHook('mounted', fn)
}

export function onUpdated(fn: () => void) {
  registerHook('updated', fn)
}

export function onBeforeUnmount(fn: () => void) {
  registerHook('beforeUnmount', fn)
}

/** 卸载完成后触发（beforeUnmount 之后、组件 effect 停止之后；Vue 3 语义） */
export function onUnmounted(fn: () => void) {
  registerHook('unmounted', fn)
}

function registerHook(type: HookType, fn: () => void) {
  if (!currentInstance) {
    console.warn('[actview] 生命周期钩子只能在组件 setup 中调用')
    return
  }
  ;(currentInstance[type] as (() => void)[]).push(fn)
}
