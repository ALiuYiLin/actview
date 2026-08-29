import type { Dep } from '../types'
import { getCurrentScope } from './effectScope'
import { getDevtoolsHook } from '../devtools'

// ============================================================
// 调度批处理 — 对齐 Vue scheduler 语义（P2-4）
//   主队列（jobQueue）：effect 更新按 id 升序（父组件先创建 id 小 → 先更新）
//   pre 队列：watch flush:'pre'（默认）——组件更新前执行
//   post 队列（一次性）：watch flush:'post'——渲染提交后执行
//   常驻 post 钩子（registerPostFlushHook）：每次提交后都执行（受控还原）
//   递归更新检测：单轮内同一 job 执行超限 → 告警并跳过（防无限循环）
// ============================================================

/** 递归更新阈值（对齐 Vue RECURSION_LIMIT） */
const RECURSION_LIMIT = 100

let effectId = 0
const jobQueue: ReactiveEffect[] = []
const preFlushQueue: (() => void)[] = []
const pendingPostFlushCbs: (() => void)[] = []
const postFlushHooks: (() => void)[] = []
let isFlushing = false
let currentFlushPromise: Promise<void> | null = null

/** 主队列：effect 更新入队（去重 + id 升序插入——父组件先于子组件更新，
 *  对齐 Vue findInsertionIndex 语义） */
export function queueJob(effect: ReactiveEffect) {
  if (!effect.active) return
  if (jobQueue.includes(effect)) return
  const id = effect.id ?? 0
  let i = jobQueue.length - 1
  while (i >= 0 && (jobQueue[i].id ?? 0) > id) i--
  jobQueue.splice(i + 1, 0, effect)
  queueFlush()
}

function queueFlush() {
  if (!currentFlushPromise) {
    currentFlushPromise = Promise.resolve().then(flushJobs)
  }
}

/** watch flush:'pre'（默认）：组件更新前执行 */
export function queuePreFlushCb(cb: () => void) {
  preFlushQueue.push(cb)
  queueFlush()
}

/** watch flush:'post'：渲染提交后执行（一次性队列，每轮清空） */
export function queuePostFlushCb(cb: () => void) {
  pendingPostFlushCbs.push(cb)
  queueFlush()
}

/** 常驻 post-flush 钩子：每次渲染提交后都执行（受控还原等） */
export function registerPostFlushHook(cb: () => void) {
  postFlushHooks.push(cb)
}

/** 递归更新检测：单轮内同一 job 执行超限 → 告警并跳过（防无限循环） */
function checkRecursive(seen: Map<any, number>, fn: any): boolean {
  const count = (seen.get(fn) ?? 0) + 1
  if (count > RECURSION_LIMIT) {
    const inst = fn.instance
    console.warn(
      `[actview] 递归更新检测：${
        inst?.type?.name ? `组件 <${inst.type.name}> ` : ''
      }effect 不断修改自身依赖导致无限触发（已跳过该 job）`,
    )
    return true
  }
  seen.set(fn, count)
  return false
}

function flushJobs() {
  if (isFlushing) return
  isFlushing = true
  const seen = new Map<any, number>()
  try {
    while (jobQueue.length || preFlushQueue.length) {
      // pre 队列：组件更新前执行（可能执行中又入队）
      if (preFlushQueue.length) {
        const cbs = preFlushQueue.splice(0)
        for (const cb of cbs) {
          if (checkRecursive(seen, cb)) continue
          cb()
        }
      }
      const job = jobQueue.shift()
      if (!job || !job.active) continue
      if (checkRecursive(seen, job)) continue
      job.run()
    }
  } finally {
    isFlushing = false
    currentFlushPromise = null
    // post 队列：渲染提交后（一次性）
    if (pendingPostFlushCbs.length) {
      const cbs = pendingPostFlushCbs.splice(0)
      for (const cb of cbs) {
        if (checkRecursive(seen, cb)) continue
        cb()
      }
    }
    // 常驻钩子（受控还原等）
    for (const hook of postFlushHooks) hook()
    // 执行中重新入队的任务 → 下一轮微任务继续（避免深栈递归）
    if (jobQueue.length || preFlushQueue.length || pendingPostFlushCbs.length) {
      queueFlush()
    }
  }
}

/** 返回本轮 flush 结束后的 Promise；传入回调则在其后执行 */
export function nextTick<T = void>(cb?: () => T): Promise<T | void> {
  const p = currentFlushPromise ?? Promise.resolve()
  return cb ? p.then(cb) : p
}

// ============================================================
// ReactiveEffect
// ============================================================

export class ReactiveEffect {
  /** 创建序 id（自增）：组件更新 effect 按挂载序分配——父组件先创建 id 小，
   *  队列按 id 升序执行 → 父先于子更新（对齐 Vue instance.uid 语义） */
  id = ++effectId
  deps: Dep[]
  /** 是否仍可响应：stop 后置 false，队列中的 pending job 将被跳过 */
  active = true
  /** 可选的调度器：设置后 trigger 不再同步 run，而是调用 scheduler */
  scheduler?: (effect: ReactiveEffect) => void
  /** 关联的组件实例（调试钩子 onRenderTracked / onRenderTriggered 用） */
  instance?: any
  /**
   * stop 钩子：effect.stop() 时调用（Vue 3 语义）。
   * watch/watchEffect 注册此处执行 pending cleanup——组件卸载
   * （scope.stop → effect.stop）时 onCleanup 得以执行。
   */
  onStop?: () => void
  private fn: () => void
  /** 重入保护：run() 执行中再次被 trigger 直接跳过（防止 effect 内修改自身依赖爆栈） */
  private _running = false
  constructor(fn: () => void, scheduler?: (effect: ReactiveEffect) => void) {
    this.fn = fn
    this.scheduler = scheduler
    this.deps = []
    // 注册进当前 effect scope（组件 setup 期间 = 组件 scope，卸载时自动停止）
    const scope = getCurrentScope()
    if (scope) scope.effects.push(this)
  }
  public run(): any {
    if (!this.active || this._running) return
    this._running = true
    // effect 重跑是独立执行上下文：恢复依赖收集
    // （数组修改方法内部 pauseTracking 期间嵌套触发的 effect 也要能重新 track）
    const prevShouldTrack = shouldTrack
    const preEffect = activeEffect
    try {
      shouldTrack = true
      cleanupEffect(this)
      activeEffect = this
      const result = this.fn()
      return result
    } finally {
      // 抛错也要恢复 activeEffect，避免泄漏到后续 track/trigger 造成级联污染
      activeEffect = preEffect
      this._running = false
      shouldTrack = prevShouldTrack
    }
  }
  /** 停止该 effect：清空所有依赖，之后不再响应；触发 onStop 钩子（幂等） */
  public stop() {
    if (!this.active) return
    this.active = false
    cleanupEffect(this)
    this.deps = []
    this.onStop?.()
  }
}

function cleanupEffect(effect: ReactiveEffect) {
  if (effect.deps === null) return
  for (const dep of effect.deps) {
    dep.delete(effect)
  }
  effect.deps.length = 0
}

let activeEffect: ReactiveEffect | null = null
const targetMap = new WeakMap<object, Map<any, Dep>>()

// ------------------------------------------------------------
// 依赖收集开关（pauseTracking）
//   数组修改方法执行期间暂停收集，避免 effect 内修改自身依赖时
//   把「修改过程内部读取」收集进当前 effect（配合 run() 重入保护）
// ------------------------------------------------------------

let shouldTrack = true
export function pauseTracking() {
  shouldTrack = false
}
export function resetTracking() {
  shouldTrack = true
}

export function track(target: object, key: any) {
  if (!activeEffect || !shouldTrack) return
  // 调试钩子：render effect 依赖收集时触发
  const inst = activeEffect.instance
  if (inst && inst.renderTracked && inst.renderTracked.length) {
    for (const hook of inst.renderTracked) hook({ target, key })
  }
  // DevTools 埋点：依赖收集
  getDevtoolsHook()?.onTrack?.({ target, key })
  let depsMap = targetMap.get(target)

  if (!depsMap) {
    depsMap = new Map()
    targetMap.set(target, depsMap)
  }

  let dep = depsMap.get(key)

  if (!dep) {
    dep = new Set()
    depsMap.set(key, dep)
  }

  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
  }
}

export function trigger(target: object, key: any) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return
  const dep = depsMap.get(key)
  if (!dep) return
  const effects = new Set(dep)
  // DevTools 埋点：依赖触发（每次 trigger 一次）
  getDevtoolsHook()?.onTrigger?.({ target, key })
  effects.forEach((effect) => {
    // 调试钩子：依赖触发 render effect 时触发
    const inst = effect.instance
    if (inst && inst.renderTriggered && inst.renderTriggered.length) {
      for (const hook of inst.renderTriggered) hook({ target, key })
    }
    // 有 scheduler 的 effect（如组件更新）走调度，否则同步执行
    if (effect.scheduler) effect.scheduler(effect)
    else effect.run()
  })
}

export interface RunEffectOptions {
  scheduler?: (effect: ReactiveEffect) => void
  /** 关联的组件实例（onRenderTracked / onRenderTriggered 调试钩子用） */
  instance?: any
}

export function runEffect(fn: () => void, options?: RunEffectOptions) {
  const _effect = new ReactiveEffect(fn, options?.scheduler)
  _effect.instance = options?.instance
  // 首次立即同步执行（挂载渲染）；后续更新由 scheduler 调度
  _effect.run()
  return _effect
}
