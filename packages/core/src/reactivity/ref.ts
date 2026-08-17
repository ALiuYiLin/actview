import { reactive } from './reactive'
import { track, trigger } from './reactive-system'

// ============================================================
// ref — 值包装的响应式引用
//   const count = ref(0)
//   count.value = 1          // 触发更新
//   对象值自动包 reactive（ref({}) 的 value 是深层响应式）
//   新增：shallowRef（浅层）、triggerRef（手动触发）、toValue（取值统一）
// ============================================================

const IS_SHALLOW = '__v_isShallow'

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

/**
 * 批量解包：对象内每个 ref 取 .value，非 ref 原样返回（仅一层）。
 * 典型用法：`const { x, ...ret } = toRefs(props)` 后
 * `<div {...unrefs(ret)} />` —— spread 在 render 期执行，逐键读取
 * 活引用 → 保持响应式（透传 rest 的简便写法）。
 */
export function unrefs<T extends Record<string, any>>(
  obj: T
): { [K in keyof T]: T[K] extends Ref<infer V> ? V : T[K] } {
  const out: any = {}
  for (const key in obj) {
    const v = obj[key]
    out[key] = isRef(v) ? v.value : v
  }
  return out
}

/**
 * 取值统一：ref 取 .value，getter 函数调用，其余原样返回。
 * 与 unref 的区别：额外支持 getter（MaybeRefOrGetter 范式）。
 * 在响应式上下文里调用 getter 会建立依赖追踪（如 computed/watch 内）。
 */
export function toValue<T>(source: T | Ref<T> | (() => T)): T {
  return typeof source === 'function'
    ? (source as () => T)()
    : unref(source as T | Ref<T>)
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

// ------------------------------------------------------------
// shallowRef / triggerRef
// ------------------------------------------------------------

/** 浅层 ref：对象值不做深层 reactive 包装（.value 整体替换才触发更新） */
export class ShallowRefImpl<T> {
  readonly __v_isRef = true
  readonly [IS_SHALLOW] = true
  private _value: T

  constructor(value: T) {
    this._value = value
  }

  get value(): T {
    track(this, 'value')
    return this._value
  }

  set value(newVal: T) {
    if (Object.is(newVal, this._value)) return
    this._value = newVal
    trigger(this, 'value')
  }
}

export function shallowRef<T>(value: T): Ref<T> {
  return new ShallowRefImpl(value) as unknown as Ref<T>
}

/** 手动触发 ref 依赖（shallowRef 内部属性变化不自动触发时使用） */
export function triggerRef(ref: Ref): void {
  trigger(ref, 'value')
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
export function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K
): Ref<T[K]> {
  const val = object[key]
  if (isRef(val)) return val as unknown as Ref<T[K]>
  return new ObjectRefImpl(object, key) as Ref<T[K]>
}

/** 将对象的每个属性转为 ref（配合解构使用：const { a, b } = toRefs(state)） */
export function toRefs<T extends object>(
  object: T
): { [K in keyof T]: Ref<T[K]> } {
  const ret: any = {}
  for (const key in object) {
    ret[key] = toRef(object, key)
  }
  return ret
}
