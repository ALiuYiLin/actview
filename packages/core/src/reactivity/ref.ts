import { reactive } from "./reactive"
import { track, trigger } from "../runtime/reactive-system"

// ============================================================
// ref — 值包装的响应式引用
//   const count = ref(0)
//   count.value = 1          // 触发更新
//   对象值自动包 reactive（ref({}) 的 value 是深层响应式）
// ============================================================

export interface Ref<T = any> {
  value: T
  readonly __v_isRef: true
}

export function isRef(v: any): v is Ref {
  return !!(v && (v as Ref).__v_isRef === true)
}

/** 解包：ref 取 .value，非 ref 原样返回 */
export function unref<T>(ref: T | Ref<T>): T {
  return isRef(ref) ? ref.value : (ref as T)
}

function toReactive<T>(value: T): T {
  return value !== null && typeof value === 'object'
    ? (reactive(value as object) as T)
    : value
}

export class RefImpl<T> {
  readonly __v_isRef = true
  private _value: T

  constructor(value: T) {
    this._value = toReactive(value)
  }

  get value(): T {
    track(this, 'value')
    return this._value
  }

  set value(newVal: T) {
    if (Object.is(newVal, this._value)) return
    this._value = toReactive(newVal)
    trigger(this, 'value')
  }
}

export function ref<T>(value: T): Ref<T> {
  return new RefImpl(value) as Ref<T>
}
