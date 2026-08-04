import { ReactiveEffect } from "../runtime/reactive-system"
import { isRef } from "./ref"
import type { Ref } from "./ref"

// ============================================================
// watch — 监听响应式源变化
//   watch(() => state.count, (n, o) => ...)
//   watch(ref, (n, o) => ...)
//   watch([ref, getter], (newVals, oldVals) => ...)
//   watch(obj, (n, o) => ...)   // 对象：深度遍历监听所有属性
//   options.immediate：初始立即执行一次（oldValue 为 undefined）
//   回调第三参 onCleanup：下一次触发前执行上一次的 cleanup
//   返回 stop 函数
// ============================================================

export interface WatchOptions {
  immediate?: boolean
}

export type WatchCleanup = (fn: () => void) => void

export function watch<T>(
  source: T | Ref<T> | (() => T) | Array<T | Ref<T> | (() => T)>,
  cb: (newVal: any, oldVal: any, onCleanup: WatchCleanup) => void,
  options: WatchOptions = {},
): () => void {
  const getter = createGetter(source)
  // 对象/数组源：默认深度监听（traverse 全量收集），
  // 新旧值同为同一引用，回调应始终触发（Vue 3 deep 语义）
  const isDeepSource = source != null && typeof source === 'object' && !isRef(source)

  let oldValue: any
  let cleanup: (() => void) | null = null
  const onCleanup: WatchCleanup = (fn) => {
    cleanup = fn
  }

  const effect = new ReactiveEffect(getter)

  let pending = false
  const runJob = () => {
    pending = false
    if (cleanup) {
      cleanup()
      cleanup = null
    }
    const newValue = effect.run()
    if (isDeepSource || hasChanged(newValue, oldValue)) {
      cb(newValue, oldValue, onCleanup)
      oldValue = newValue
    }
  }

  // 默认异步：变化后入微任务统一执行（与组件批处理同帧）
  effect.scheduler = () => {
    if (pending) return
    pending = true
    Promise.resolve().then(runJob)
  }

  if (options.immediate) {
    runJob() // 首次：cb(newVal, undefined)
  } else {
    oldValue = effect.run() // 首次求值：收集依赖、记录旧值，不回调
  }

  return () => {
    effect.stop()
    if (cleanup) {
      cleanup()
      cleanup = null
    }
  }
}

// ------------------------------------------------------------
// source → getter
// ------------------------------------------------------------

function createGetter(source: any): () => any {
  if (isRef(source)) return () => source.value
  if (typeof source === 'function') return source
  if (Array.isArray(source)) {
    return () =>
      source.map((s) =>
        isRef(s) ? s.value : typeof s === 'function' ? s() : s,
      )
  }
  // 普通对象：深度遍历（递归读全部属性，建立全量依赖）
  return () => traverse(source)
}

/** 深度遍历：递归读取对象/数组的全部属性（WeakSet 防环） */
function traverse(value: any, seen = new Set<any>()): any {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value
  seen.add(value)
  if (Array.isArray(value)) {
    value.forEach((v) => traverse(v, seen))
  } else {
    for (const key in value) traverse(value[key], seen)
  }
  return value
}

/** 新旧值比较：数组逐项比较，其余 Object.is */
function hasChanged(a: any, b: any): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]))
  }
  return !Object.is(a, b)
}
