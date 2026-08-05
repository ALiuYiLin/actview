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

// ============================================================
// toRef / toRefs — 把对象属性转为 ref（保持响应式）
//   const state = reactive({ count: 0 })
//   const count = toRef(state, 'count')     // 单属性
//   const { count } = toRefs(state)         // 批量解构
//   读写走原对象（reactive 代理的 get/set 陷阱）→ 天然 track/trigger
// ============================================================

/** 对象属性引用：读写委托给源对象（代理的 get/set 陷阱提供响应性） */
class ObjectRefImpl<T extends object, K extends keyof T> implements Ref<T[K]> {
  readonly __v_isRef = true
  readonly _object: T
  readonly _key: K

  constructor(object: T, key: K) {
    this._object = object
    this._key = key
  }

  get value(): T[K] {
    return this._object[this._key]
  }

  set value(newVal: T[K]) {
    this._object[this._key] = newVal
  }
}

/** 将对象属性转为 ref：源对象是 reactive 时保持响应式；属性已是 ref 则原样返回 */
export function toRef<T extends object, K extends keyof T>(object: T, key: K): Ref<T[K]> {
  const val = object[key]
  if (isRef(val)) return val as unknown as Ref<T[K]>
  return new ObjectRefImpl(object, key) as Ref<T[K]>
}

/** 将对象的每个属性转为 ref（配合解构使用：const { a, b } = toRefs(state)） */
export function toRefs<T extends object>(object: T): { [K in keyof T]: Ref<T[K]> } {
  const ret: any = {}
  for (const key in object) {
    ret[key] = toRef(object, key)
  }
  return ret
}
