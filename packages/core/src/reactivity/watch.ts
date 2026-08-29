import {
  ReactiveEffect,
  nextTick,
  queuePostFlushCb,
  queuePreFlushCb,
} from './reactive-system'
import { isRef } from './ref'
import type { Ref } from './ref'

// ============================================================
// watch — 监听响应式源变化
//   watch(() => state.count, (n, o) => ...)
//   watch(ref, (n, o) => ...)
//   watch([ref, getter], (newVals, oldVals) => ...)
//   watch(obj, (n, o) => ...)   // 对象：默认深度遍历
//   options：
//     - immediate：初始立即执行一次
//     - deep：getter/ref 源深度遍历；对象源默认深度，deep: false 关闭
//     - flush：'pre'（默认，微任务）/ 'post'（组件 flush 后）/ 'sync'（同步）
//     - once：回调只执行一次后自动 stop
//   回调第三参 onCleanup：下一次触发前执行上一次 cleanup
//   onWatcherCleanup(fn)：在回调执行期间注册 cleanup（等价第三参，Vue 3.5 风格）
//   返回 stop 函数
// ============================================================

export interface WatchOptions {
  immediate?: boolean
  deep?: boolean
  flush?: 'pre' | 'post' | 'sync'
  once?: boolean
}

export type WatchCleanup = (fn: () => void) => void

/** watch 的 source 类型：单值 / ref / getter / 同质数组 / 混合 ref+getter 数组 */
export type WatchSource<T> = T | Ref<T> | (() => T)

// ------------------------------------------------------------
// onWatcherCleanup — 模块级 currentWatcher 上下文
// ------------------------------------------------------------

let currentWatcher: { cleanup: (() => void) | null } | null = null

/** 初始 oldValue 哨兵（Vue 3 INITIAL_WATCHER_VALUE）：immediate 首次回调
 *  无条件执行——即使首次求值结果恰好是 undefined（undefined === 裸初始
 *  值会令 hasChanged 判等跳过回调）。首次回调的 oldVal 参数显示为 undefined。 */
const INITIAL_WATCHER_VALUE: any = Symbol('initial-watcher-value')

/**
 * 在 watch 回调执行期间注册清理函数：下次回调前（或 stop 时）执行。
 * 与回调第三参 onCleanup 等价；只能在 watch 回调内调用。
 */
export function onWatcherCleanup(cleanupFn: () => void, failSilently = false) {
  if (currentWatcher) {
    currentWatcher.cleanup = cleanupFn
  } else if (!failSilently) {
    console.warn('[actview] onWatcherCleanup 只能在 watch 回调中调用')
  }
}

export function watch<T>(
  source:
    | WatchSource<T>
    | WatchSource<T>[]
    | Array<Ref<any> | (() => any)>, // 混合来源数组（Vue 兼容：元素可不同类型）
  cb: (newVal: any, oldVal: any, onCleanup: WatchCleanup) => void,
  options: WatchOptions = {}
): () => void {
  const { immediate = false, deep, flush = 'pre', once = false } = options

  const getter = createGetter(source, deep)
  // 对象源默认深度监听（traverse 全量收集），新旧值同为同一引用，
  // 回调应始终触发（Vue 3 deep 语义）；deep: true 对任意源同样强制触发
  const forceTrigger =
    deep === true ||
    (source != null && typeof source === 'object' && !isRef(source) && deep !== false)

  let oldValue: any = Array.isArray(source)
    ? new Array((source as any[]).length).fill(INITIAL_WATCHER_VALUE)
    : INITIAL_WATCHER_VALUE
  let cleanup: (() => void) | null = null
  const onCleanup: WatchCleanup = (fn) => {
    cleanup = fn
  }

  const effect = new ReactiveEffect(getter)
  // Vue 3 语义：effect.stop()（含组件卸载 scope.stop → effect.stop）时
  // 执行 pending cleanup——onCleanup 在卸载时也得到调用
  effect.onStop = () => {
    if (cleanup) {
      cleanup()
      cleanup = null
    }
  }

  const runJob = () => {
    // stop() 后跳过 stale 微任务：effect 已失效，effect.run() 会短路返回
    // undefined，若继续执行会把 undefined 当 newValue 传给回调
    // （deep/forceTrigger 场景无条件触发），并可能重复执行 cleanup。
    // 对齐 Vue 3：job 开头有 !effect.active 守卫。
    if (!effect.active) return
    pending = false
    if (cleanup) {
      cleanup()
      cleanup = null
    }
    const newValue = effect.run()
    if (forceTrigger || hasChanged(newValue, oldValue)) {
      const watcher = { cleanup: null as (() => void) | null }
      currentWatcher = watcher
      // 首次回调（oldValue 仍含哨兵）：oldVal 显示为 undefined——
      // 单值源直接 undefined；数组源逐元素显示（Vue 3 语义）
      cb(
        newValue,
        oldValue === INITIAL_WATCHER_VALUE
          ? undefined
          : Array.isArray(oldValue) &&
              oldValue.some((v: any) => v === INITIAL_WATCHER_VALUE)
            ? oldValue.map((v: any) =>
                v === INITIAL_WATCHER_VALUE ? undefined : v,
              )
            : oldValue,
        onCleanup,
      )
      currentWatcher = null
      if (watcher.cleanup) cleanup = watcher.cleanup
      oldValue = newValue
      if (once) stop()
    }
  }

  let pending = false
  // flush 调度（P2-4 对齐 Vue scheduler 双层队列）：
  //   sync 同步执行；post 入一次性 post 队列（渲染提交后）；pre（默认）入 pre 队列
  //   （组件更新前）。时序由调度器统一保证，不再依赖各自微任务注册顺序。
  effect.scheduler = () => {
    if (pending) return
    pending = true
    if (flush === 'sync') {
      runJob()
    } else if (flush === 'post') {
      queuePostFlushCb(runJob)
    } else {
      queuePreFlushCb(runJob)
    }
  }

  const stop = () => {
    effect.stop()
    if (cleanup) {
      cleanup()
      cleanup = null
    }
  }

  if (immediate) {
    runJob() // 首次：cb(newVal, undefined)。Vue 3 语义：immediate 首次回调总是
    // 同步执行（无论 flush），flush 只影响后续 trigger 的调度时机
  } else {
    oldValue = effect.run() // 首次求值：收集依赖、记录旧值，不回调
  }

  return stop
}

// ------------------------------------------------------------
// source → getter
// ------------------------------------------------------------

function createGetter(source: any, deep?: boolean): () => any {
  if (isRef(source)) {
    const g = () => source.value
    return deep ? () => traverse(g()) : g
  }
  if (typeof source === 'function') {
    return deep ? () => traverse(source()) : source
  }
  if (Array.isArray(source)) {
    return () =>
      source.map((s) => {
        const v = isRef(s) ? s.value : typeof s === 'function' ? s() : s
        return deep ? traverse(v) : v
      })
  }
  // 普通对象：默认深度遍历；deep: false 显式关闭
  return deep === false ? () => source : () => traverse(source)
}

/** 深度遍历：递归读取对象/数组的全部属性（WeakSet 防环） */
function traverse(value: any, seen = new Set<any>()): any {
  if (value === null || typeof value !== 'object' || seen.has(value))
    return value
  seen.add(value)
  if (value instanceof Map || value instanceof Set) {
    value.forEach((v: any) => traverse(v, seen))
  } else if (Array.isArray(value)) {
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

// ============================================================
// watchEffect — 立即执行并自动追踪依赖的副作用
//   watchEffect(() => { console.log(state.count) })
//   首次立即执行一次（收集依赖）；依赖变化异步触发（与组件批处理同帧）；
//   支持 flush 选项与 onWatcherCleanup；返回 stop 函数；
//   组件 setup 内创建 =》 随组件卸载自动停止
// ============================================================

export function watchEffect(
  effect: () => void,
  options: { flush?: 'pre' | 'post' | 'sync' } = {}
): () => void {
  const { flush = 'pre' } = options
  const eff = new ReactiveEffect(run)

  let pending = false
  let cleanup: (() => void) | null = null

  function run() {
    // 支持回调内 onWatcherCleanup 注册 cleanup
    if (cleanup) {
      cleanup()
      cleanup = null
    }
    const watcher = { cleanup: null as (() => void) | null }
    currentWatcher = watcher
    effect()
    currentWatcher = null
    if (watcher.cleanup) cleanup = watcher.cleanup
  }

  eff.scheduler = () => {
    if (pending) return
    pending = true
    if (flush === 'sync') {
      pending = false
      eff.run()
    } else if (flush === 'post') {
      Promise.resolve().then(() => {
        pending = false
        nextTick().then(() => eff.run())
      })
    } else {
      Promise.resolve().then(() => {
        pending = false
        eff.run()
      })
    }
  }

  eff.run() // 立即执行一次，收集依赖（Vue 3 语义：首次同步执行，flush 只影响后续 trigger）

  // Vue 3 语义：effect.stop()（含组件卸载 scope.stop）时执行 pending cleanup
  eff.onStop = () => {
    if (cleanup) {
      cleanup()
      cleanup = null
    }
  }

  return () => {
    eff.stop() // onStop 已执行 cleanup（幂等）
  }
}
