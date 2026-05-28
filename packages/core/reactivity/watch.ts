import { Ref } from "../types";
import { eventBus } from "./event";
import { getReactiveTriggerRef } from "./reactive";
import { getCurrentUpdateFn, setCurrentUpdateFn } from "../hooks";

function isRefLike<T = unknown>(value: unknown): value is Ref<T> {
  return !!value && typeof value === 'object' && (value as any).__isRef === true
}

export function watch<T>(source: Ref<T> | (() => T) | object, callback: (newValue: T, oldValue: T) => void) {
  if(typeof source === 'function') {
    const getter = source as () => T
    let oldValue: T

    const runGetter = () => {
      const prev = getCurrentUpdateFn()
      setCurrentUpdateFn(job)
      const value = getter()
      setCurrentUpdateFn(prev)
      return value
    }

    const job = () => {
      const newValue = runGetter()
      if(Object.is(newValue, oldValue)) return
      callback(newValue, oldValue)
      oldValue = newValue
    }

    oldValue = runGetter()
    return
  }

  if(isRefLike<T>(source)) {
    const ref = source as Ref<T>
    let oldValue = ref.value;

    eventBus.subscribe(
      ref,
      () => {
        const newValue = ref.value;
        if(Object.is(newValue, oldValue)) return
        callback(newValue, oldValue);
        oldValue = newValue;
      }
    );
    return
  }

  const triggerRef = getReactiveTriggerRef(source)
  if(!triggerRef) {
    throw new Error('watch 只能监控 ref、reactive 返回值，或 getter 函数')
  }

  // shallowClone 在无 reactive 上下文中读取属性，避免 getter 副作用
  function shallowClone(obj: any): any {
    const prev = getCurrentUpdateFn()
    setCurrentUpdateFn(null)
    const clone = { ...obj }
    setCurrentUpdateFn(prev)
    return clone
  }

  let oldSnapshot = shallowClone(source) as T
  eventBus.subscribe(triggerRef, () => {
    const newSnapshot = shallowClone(source) as T
    callback(newSnapshot, oldSnapshot)
    oldSnapshot = newSnapshot
  })
}
