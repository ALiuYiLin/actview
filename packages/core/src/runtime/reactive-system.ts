import { Dep } from "../types"

export class ReactiveEffect {
  deps: Dep[] | null
  private fn: ()=> void
  constructor(fn: ()=> void){
    this.fn = fn
    this.deps = null
  }
  public run(){
    cleanupEffect(this)
    const preEffect = activeEffect
    activeEffect = this
    this.run()
    activeEffect = preEffect
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
  if(activeEffect === null) return
  const keyDepMap = targetMap.get(target) || new Map<PropertyKey, Dep>()
  const dep = keyDepMap.get(key) || new Set<ReactiveEffect>()
  dep.add(activeEffect)
}

export function trigger(target: object, key: PropertyKey){
  const keyDepMap = targetMap.get(target)
  if(!keyDepMap) return
  const dep = keyDepMap.get(key)
  if(!dep) return
  const effects = Array.from(dep)
  effects.forEach(effect => effect.run())
}

export function runEffect(fn: ()=> void){
  const _effect = new ReactiveEffect(fn)
  _effect.run()
  return _effect
}