import type { Dep } from "../types"

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
  constructor(fn: ()=> void, scheduler?: (effect: ReactiveEffect) => void){
    this.fn = fn
    this.scheduler = scheduler
    this.deps = []
  }
  public run(): any {
    if (!this.active) return
    cleanupEffect(this)
    const preEffect = activeEffect
    activeEffect = this
    const result = this.fn()
    activeEffect = preEffect
    return result
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

export function track(target: object, key: PropertyKey){
  if(!activeEffect) return
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
