// ============================================================
// 生命周期 — currentInstance 栈式上下文 + 钩子注册/调用
// （docs/renderer-design.md §9 / §10）
//
//   - setup / 钩子执行期间 currentInstance 指向当前组件实例；
//     setCurrentInstance 返回旧值，调用方在 finally 中恢复（嵌套 mount 场景）。
//   - onXxx 把钩子 push 进实例上的 hooks 数组（数组由 createComponentInstance 初始化）。
//   - invokeHooks 统一执行：恢复实例上下文 + pauseTracking，
//     保证钩子内写状态不会反向收集依赖（对齐 §9 依赖收集边界表）。
// ============================================================

import { pauseTracking, resetTracking } from '@actview/reactivity'
import type {
  ComponentInternalInstance,
  ErrorCapturedHook,
  Hook,
  LifecycleType,
} from './instance'

/** 当前组件实例（setup / 钩子执行上下文）；null 表示不在组件上下文内 */
let currentInstance: ComponentInternalInstance | null = null

/** 读取当前组件实例（只能在 setup / 钩子内拿到值） */
export function getCurrentInstance(): ComponentInternalInstance | null {
  return currentInstance
}

/**
 * 设置当前组件实例，返回旧值。
 * 调用方负责用返回值恢复（嵌套 mount / 钩子执行结束后恢复父上下文）。
 */
export function setCurrentInstance(
  instance: ComponentInternalInstance | null,
): ComponentInternalInstance | null {
  const prev = currentInstance
  currentInstance = instance
  return prev
}

/**
 * 注册生命周期钩子。
 * target 缺省为 currentInstance；没有 target（setup 外调用）时 warn 并忽略。
 */
export function injectHook(
  type: LifecycleType,
  hook: Hook,
  target: ComponentInternalInstance | null = currentInstance,
): void {
  if (!target) {
    console.warn(
      `[actview] ${type} 生命周期钩子只能在组件 setup 中注册，已忽略。`,
    )
    return
  }
  ;(target[type] as Hook[]).push(hook)
}

/**
 * 执行一组钩子（renderer 在挂载/更新/卸载路径调用）。
 * - 执行期间把 currentInstance 指向 instance（缺省沿用当前值），结束后恢复；
 * - 执行期间 pauseTracking，钩子内读取响应式数据不收集依赖；
 * - 钩子抛错时也保证 tracking / currentInstance 复位，错误继续向上抛。
 */
export function invokeHooks(
  hooks: Hook[],
  instance?: ComponentInternalInstance | null,
): void {
  if (!hooks || hooks.length === 0) return

  const target = instance === undefined ? currentInstance : instance
  const prev = setCurrentInstance(target)
  pauseTracking()
  try {
    for (const hook of hooks) hook()
  } finally {
    resetTracking()
    setCurrentInstance(prev)
  }
}

/**
 * 注册错误捕获钩子（子树 setup / render / patch / unmount 错误会沿 parent
 * 链调用各实例的 errorCaptured；返回 false 表示已处理、阻止继续向上）。
 *
 * 与生命周期钩子不同，errorCaptured 是「即时调用」的（由 errorHandling 的
 * handleError 在错误现场执行），不进入 post 队列。
 */
export function onErrorCaptured(
  hook: ErrorCapturedHook,
  target: ComponentInternalInstance | null = getCurrentInstance(),
): void {
  if (!target) {
    console.warn(
      '[actview] onErrorCaptured 只能在组件 setup 中注册，已忽略。',
    )
    return
  }
  target.errorCaptured.push(hook)
}

export const onBeforeMount = (
  hook: Hook,
  target?: ComponentInternalInstance | null,
): void => injectHook('beforeMount', hook, target)

export const onMounted = (
  hook: Hook,
  target?: ComponentInternalInstance | null,
): void => injectHook('mounted', hook, target)

export const onBeforeUpdate = (
  hook: Hook,
  target?: ComponentInternalInstance | null,
): void => injectHook('beforeUpdate', hook, target)

export const onUpdated = (
  hook: Hook,
  target?: ComponentInternalInstance | null,
): void => injectHook('updated', hook, target)

export const onBeforeUnmount = (
  hook: Hook,
  target?: ComponentInternalInstance | null,
): void => injectHook('beforeUnmount', hook, target)

export const onUnmounted = (
  hook: Hook,
  target?: ComponentInternalInstance | null,
): void => injectHook('unmounted', hook, target)

/**
 * 注册 activated 钩子：KeepAlive 缓存的组件被重新激活时由 renderer 调用
 * `invokeHooks(instance.activated, instance)`。
 *
 * activated / deactivated 不在 LifecycleType 联合内（实例字段已由
 * createComponentInstance 初始化），因此这里直接 push 对应数组。
 */
export function onActivated(
  hook: Hook,
  target: ComponentInternalInstance | null = currentInstance,
): void {
  if (!target) {
    console.warn(
      '[actview] onActivated 生命周期钩子只能在组件 setup 中注册，已忽略。',
    )
    return
  }
  target.activated.push(hook)
}

/**
 * 注册 deactivated 钩子：KeepAlive 缓存的组件被移入缓存（失活）时由
 * renderer 调用 `invokeHooks(instance.deactivated, instance)`。
 */
export function onDeactivated(
  hook: Hook,
  target: ComponentInternalInstance | null = currentInstance,
): void {
  if (!target) {
    console.warn(
      '[actview] onDeactivated 生命周期钩子只能在组件 setup 中注册，已忽略。',
    )
    return
  }
  target.deactivated.push(hook)
}
