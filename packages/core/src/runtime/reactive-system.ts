import type { Dep } from "../types"

export class ReactiveEffect {
  deps: Dep[]
  private fn: ()=> void
  constructor(fn: ()=> void){
    this.fn = fn
    this.deps = []
  }
  public run(){
    cleanupEffect(this)
    const preEffect = activeEffect
    activeEffect = this
    this.fn()
    activeEffect = preEffect
  }
  /** 停止该 effect：清空所有依赖，之后不再响应 */
  public stop(){
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
  effects.forEach(effect => effect.run())
}

export function runEffect(fn: ()=> void){
  const _effect = new ReactiveEffect(fn)
  _effect.run()
  return _effect
}