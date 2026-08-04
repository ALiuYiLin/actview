import type { ComponentInstance } from "./mountComponent"

// ============================================================
// 生命周期钩子 — 模块级 currentInstance 上下文
//   onMounted / onUpdated / onBeforeUnmount 只能在组件 setup 中调用
//   （setup 执行期间 currentInstance 指向该组件实例）
// ============================================================

let currentInstance: ComponentInstance | null = null

export function getCurrentInstance(): ComponentInstance | null {
  return currentInstance
}

export function setCurrentInstance(instance: ComponentInstance | null) {
  currentInstance = instance
}

type HookType = 'mounted' | 'updated' | 'beforeUnmount'

export function onMounted(fn: () => void) {
  registerHook('mounted', fn)
}

export function onUpdated(fn: () => void) {
  registerHook('updated', fn)
}

export function onBeforeUnmount(fn: () => void) {
  registerHook('beforeUnmount', fn)
}

function registerHook(type: HookType, fn: () => void) {
  if (!currentInstance) {
    console.warn('[actview] 生命周期钩子只能在组件 setup 中调用')
    return
  }
  ;(currentInstance[type] as (() => void)[]).push(fn)
}
