import { track, trigger } from "../runtime/reactive-system"

export function reactive<T extends object>(obj: T){
  return new Proxy(obj,{
    get(target, key, receiver){
      track(target, key)
      return Reflect.get(target,key,receiver)
    },
    set(target, key, value, receiver){
      const oldValue = Reflect.get(target, key, receiver)
      const result = Reflect.set(target, key, value, receiver)
      if(oldValue !== value){
        trigger(target, key)
      }
      return result
    },
    deleteProperty(target, key){
      const had = Reflect.has(target, key)
      const result = Reflect.deleteProperty(target, key)
      if(had){
        trigger(target, key)
      }
      return result
    }
  })
}