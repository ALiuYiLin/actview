import { Ref } from "../types";
import { eventBus } from "./event";
import { getCurrentUpdateFn } from "../hooks";

const reactiveTriggerMap = new WeakMap<object, Ref<any>>()

export function getReactiveTriggerRef(target: unknown): Ref<any> | null {
  if(target && typeof target === 'object') return reactiveTriggerMap.get(target as object) ?? null
  return null
}

export function reactive<T extends object>(inittialValue: T): T {
  const triggerRef = { value: null, __isRef: true as const } as Ref<any>

  const createReactiveObject = (obj: any): any=> {
    if(obj === null || typeof obj !== 'object') return obj
    
    // 如果是数组，递归处理每个元素
    if(Array.isArray(obj)){
      return reactiveArray(obj)
    }

    // 处理普通对象
    const proxy = new Proxy(obj, {
      get(target, key){
        const currentUpdateFn = getCurrentUpdateFn()
        if(currentUpdateFn) eventBus.subscribe(triggerRef, currentUpdateFn)
        
        const value = target[key]
        // 如果属性值是对象，递归代理
        if(value !== null && typeof value === 'object'){
          return createReactiveObject(value)
        }
        return value
      },
      set(target, key, newValue) {
        const oldValue = target[key]
        if(oldValue !== newValue) {
          target[key] = newValue
          eventBus.publish(triggerRef)
        }
        return true
      },
      deleteProperty(target, key){
        const result = Reflect.deleteProperty(target, key)
        eventBus.publish(triggerRef);
        return result;
      }
   
    })

    reactiveTriggerMap.set(proxy, triggerRef)
    return proxy
  }
  return createReactiveObject(inittialValue)
}


export function reactiveArray<T extends object>(inittialValue: T): T {
  // 需要拦截的数组变更方法
  const arrayMethods = [
    'push', 'pop', 'shift', 'unshift',
    'splice', 'sort', 'reverse', 'fill',
    'copyWithin'
  ]

  const triggerRef = {value: null, __isRef: true as const} as Ref<any>

  if(Array.isArray(inittialValue)){
    const proxy = new Proxy(inittialValue.map(item=>reactive(item)),{
      get(target, key){
        const value = target[key as keyof typeof target]
        const currentUpdateFn = getCurrentUpdateFn()
        if(currentUpdateFn) eventBus.subscribe(triggerRef,currentUpdateFn)
        
        if(typeof key === 'string' && arrayMethods.includes(key) && typeof value === 'function'){
          return  function(...args: any[]){
            const result = (value as Function).apply(target, args);
            eventBus.publish(triggerRef);
            return result;
          }
        }

        return value;
      },
      set(target, key, newValue){
        const result = Reflect.set(target, key, reactive(newValue))
        if(typeof key === 'string' && (!isNaN(Number(key)) || key === 'length')) eventBus.publish(triggerRef)
        return result
      }
    }) as T
    reactiveTriggerMap.set(proxy as unknown as object, triggerRef)
    return proxy
  }
  return inittialValue
}
