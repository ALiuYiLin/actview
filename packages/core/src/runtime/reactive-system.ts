import type { Dep } from "../types"
import { getCurrentScope } from "./effectScope"

// ============================================================
// 调度批处理 — effect 更新入微任务队列去重
//   trigger =》 queueJob（Set 去重）=》 微任务统一 flush =》 effect.run()
//   nextTick(cb?)：等待本轮 flush 完成
// ============================================================

const jobQueue = new Set<ReactiveEffect>()
let isFlushing = false
let currentFlushPromise: Promise<void> | null = null

/** 把 effect 更新加入队列（同轮去重），并调度微任务 flush */
export function queueJob(effect: ReactiveEffect) {
  if (!effect.active) return
  jobQueue.add(effect)
  if (!isFlushing) {
    currentFlushPromise = Promise.resolve().then(flushJobs)
  }
}

function flushJobs() {
  isFlushing = true
  // 逐个取出执行；执行中再次入队的 job 会在本轮继续处理（Set 迭代）
  while (jobQueue.size) {
    const job = jobQueue.values().next().value
    if (!job) break
    jobQueue.delete(job)
    job.run()
  }
  isFlushing = false
  currentFlushPromise = null
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
  deps: Dep[]
  /** 是否仍可响应：stop 后置 false，队列中的 pending job 将被跳过 */
  active = true
  /** 可选的调度器：设置后 trigger 不再同步 run，而是调用 scheduler */
  scheduler?: (effect: ReactiveEffect) => void
  private fn: ()=> void
  /** 重入保护：run() 执行中再次被 trigger 直接跳过（防止 effect 内修改自身依赖爆栈） */
  private _running = false
  constructor(fn: ()=> void, scheduler?: (effect: ReactiveEffect) => void){
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
    try {
      shouldTrack = true
      cleanupEffect(this)
      const preEffect = activeEffect
      activeEffect = this
      const result = this.fn()
      activeEffect = preEffect
      return result
    } finally {
      this._running = false
      shouldTrack = prevShouldTrack
    }
  }
  /** 停止该 effect：清空所有依赖，之后不再响应 */
  public stop(){
    if (!this.active) return
    this.active = false
    cleanupEffect(this)
    this.deps = []
  }
}


function cleanupEffect(effect: ReactiveEffect){
  if(effect.deps === null) return
  for(const dep of effect.deps){
    dep.delete(effect)
  }
  effect.deps.length = 0
}

let activeEffect: ReactiveEffect | null = null
const targetMap = new WeakMap<object,Map<PropertyKey,Dep>>()

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

export function track(target: object, key: PropertyKey){
  if(!activeEffect || !shouldTrack) return
  let depsMap = targetMap.get(target)

  if(!depsMap){
    depsMap = new Map()
    targetMap.set(target,depsMap)
  }

  let dep = depsMap.get(key)

  if(!dep){
    dep = new Set()
    depsMap.set(key, dep)
  }

  if(!dep.has(activeEffect)){
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
  }
}


export function trigger(target: object, key: PropertyKey){
  const depsMap = targetMap.get(target)
  if(!depsMap) return
  const dep = depsMap.get(key)
  if(!dep) return
  const effects = new Set(dep)
  effects.forEach(effect => {
    // 有 scheduler 的 effect（如组件更新）走调度，否则同步执行
    if (effect.scheduler) effect.scheduler(effect)
    else effect.run()
  })
}

export interface RunEffectOptions {
  scheduler?: (effect: ReactiveEffect) => void
}

export function runEffect(fn: ()=> void, options?: RunEffectOptions){
  const _effect = new ReactiveEffect(fn, options?.scheduler)
  // 首次立即同步执行（挂载渲染）；后续更新由 scheduler 调度
  _effect.run()
  return _effect
}
