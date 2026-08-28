import {
  track,
  trigger,
  pauseTracking,
  resetTracking
} from './reactive-system'

// ============================================================
// reactive — 深度/浅层响应式代理 + 只读代理 + 判型工具
//   支持：普通对象 / 数组 / Map / Set / WeakMap / WeakSet
//   工具：toRaw / isReactive / isReadonly / isProxy / isShallow / markRaw
// ============================================================

// ------------------------------------------------------------
// 内部标记（对齐 Vue 3 ReactiveFlags，字符串避免跨模块 Symbol 不一致）
// ------------------------------------------------------------
const SKIP = '__v_skip'
const RAW = '__v_raw'
const IS_REACTIVE = '__v_isReactive'
const IS_READONLY = '__v_isReadonly'
const IS_SHALLOW = '__v_isShallow'

const COMMON = 1 // 普通对象 / 数组
const COLLECTION = 2 // Map / Set / WeakMap / WeakSet
const INVALID = 0 // Date / RegExp / 自定义类实例等，不代理

/** 原始类型名：Object.prototype.toString 的 '[object Xxx]' → 'Xxx' */
function getRawType(value: any): string {
  return Object.prototype.toString.call(value).slice(8, -1)
}

function targetTypeMap(rawType: string): number {
  switch (rawType) {
    case 'Object':
    case 'Array':
      return COMMON
    case 'Map':
    case 'Set':
    case 'WeakMap':
    case 'WeakSet':
      return COLLECTION
    default:
      return INVALID
  }
}

function isObject(value: any): boolean {
  return value !== null && typeof value === 'object'
}

// ------------------------------------------------------------
// 判型 / 原始值工具
// ------------------------------------------------------------

/** 标记对象为「原始值」：reactive/readonly 遇到它时跳过代理 */
export function markRaw<T extends object>(obj: T): T {
  ;(obj as any)[SKIP] = true
  return obj
}

/** 递归取原始对象：代理 → 原始；非代理原样返回 */
export function toRaw<T>(observed: T): T {
  const raw = observed && (observed as any)[RAW]
  return raw ? toRaw(raw) : observed
}

/** 是否响应式代理（readonly 代理需递归判断其 raw 是否响应式） */
export function isReactive(value: unknown): boolean {
  if (isReadonly(value)) {
    return isReactive((value as any)[RAW])
  }
  return !!(value && (value as any)[IS_REACTIVE])
}

/** 是否只读代理 */
export function isReadonly(value: unknown): boolean {
  return !!(value && (value as any)[IS_READONLY])
}

/** 是否响应式或只读代理 */
export function isProxy(value: unknown): boolean {
  return isReactive(value) || isReadonly(value)
}

/** 是否浅层代理（shallowReactive / shallowRef / shallowReadonly） */
export function isShallow(value: unknown): boolean {
  return !!(value && (value as any)[IS_SHALLOW])
}

/** 是否应对该值做响应式代理 */
function shouldReactive(v: any): boolean {
  if (!isObject(v) || (v as any)[SKIP] || !Object.isExtensible(v)) return false
  const type = targetTypeMap(getRawType(v))
  if (type === COLLECTION) return true // Map / Set / WeakMap / WeakSet
  if (type === INVALID) return false // Date / RegExp / 自定义类实例等
  // COMMON：数组，或「真·普通对象」（proto 为 Object.prototype / null）。
  // class 实例（如 RefImpl）proto 非 Object.prototype，不代理 —— 保持原 isPlainObject 语义
  if (Array.isArray(v)) return true
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

// ------------------------------------------------------------
// 数组 instrumentation
//   - 修改方法：pauseTracking 包裹（避免 effect 内改自身依赖时
//     把修改过程内部读取收集进当前 effect）
//   - identity 方法（indexOf/includes/lastIndexOf）：track 全部索引 +
//     对 reactive 元素做 toRaw 比较（Vue 3 语义）
// ------------------------------------------------------------

const MUTATING_ARRAY_METHODS = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
] as const

const mutatingInstrumentations: Record<string, (...args: any[]) => any> = {}
MUTATING_ARRAY_METHODS.forEach((method) => {
  mutatingInstrumentations[method] = function (this: any, ...args: any[]) {
    pauseTracking()
    const res = (Array.prototype as any)[method].apply(this, args)
    resetTracking()
    return res
  }
})

const IDENTITY_ARRAY_METHODS = ['includes', 'indexOf', 'lastIndexOf'] as const

const identityInstrumentations: Record<string, (...args: any[]) => any> = {}
IDENTITY_ARRAY_METHODS.forEach((method) => {
  const arrayMethod = (Array.prototype as any)[method]
  identityInstrumentations[method] = function (this: any, ...args: any[]) {
    const arr = toRaw(this)
    // track 所有索引：数组内容变化（push/索引赋值）时依赖可被触发
    for (let i = 0; i < this.length; i++) track(arr, String(i))
    // 先用原始参数跑（参数可能是 reactive 代理，直接比较）
    const res = arrayMethod.apply(arr, args)
    if (res === -1 || res === false) {
      // 未命中：用 toRaw 后的参数再跑（reactive 元素 → 原始值）
      return arrayMethod.apply(arr, args.map(toRaw))
    }
    return res
  }
})

/** 迭代键：代表「对象的 key 集合」，用于 for...in / in / 集合 size 的依赖 */
const ITERATE_KEY = Symbol('iterate')

/** 数组整数索引 key（'0'/'12' 等；'length'/'foo' 不是） */
const isIntegerKey = (key: any) =>
  typeof key === 'string' &&
  key !== 'NaN' &&
  key[0] !== '-' &&
  String(parseInt(key, 10)) === key

/** 数组新增整数索引时：length 自动同步，set('length') 检测不到变化，需显式触发 */
function triggerArrayLengthIfNeeded(
  target: any,
  key: any,
  hadKey: boolean
) {
  if (!hadKey && Array.isArray(target) && isIntegerKey(key)) {
    trigger(target, 'length')
  }
}

// ------------------------------------------------------------
// 对象 / 数组代理
// ------------------------------------------------------------

/** 惰性深层代理的缓存 */
const reactiveMap = new WeakMap<object, any>()
const shallowReactiveMap = new WeakMap<object, any>()
const readonlyMap = new WeakMap<object, any>()
const shallowReadonlyMap = new WeakMap<object, any>()

function warnReadonly(key: any) {
  console.warn(`[actview] readonly 对象不允许修改: ${String(key)}`)
}

/**
 * 对象 handlers（普通对象 / 顶层数组共用）。
 * 数组 identity/mutation 方法经 get 陷阱拦截；嵌套数组值惰性建数组代理。
 */
function createObjectHandlers(readonly: boolean, shallow: boolean) {
  return {
    get(target: object, key: any, receiver: any) {
      if (key === RAW) return target
      if (key === IS_REACTIVE) return !readonly
      if (key === IS_READONLY) return readonly
      if (key === IS_SHALLOW) return shallow

      const targetIsArray = Array.isArray(target)
      if (targetIsArray) {
        if (key in identityInstrumentations) return identityInstrumentations[key]
        if (!readonly && key in mutatingInstrumentations)
          return mutatingInstrumentations[key]
      }

      track(target, key)
      const value = Reflect.get(target, key, receiver)
      if (shallow) return value
      if (Array.isArray(value))
        return new Proxy(
          value,
          createArrayHandlers({ target, key }, readonly, shallow)
        )
      return shouldReactive(value)
        ? readonly
          ? readonlyProxy(value)
          : reactiveProxy(value)
        : value
    },
    set(target: object, key: any, value: any, receiver: any) {
      if (readonly) {
        warnReadonly(key)
        return true
      }
      const hadKey = Reflect.has(target, key)
      const oldValue = Reflect.get(target, key, receiver)
      const result = Reflect.set(target, key, value, receiver)
      if (result && oldValue !== value) {
        trigger(target, key)
        if (!hadKey) trigger(target, ITERATE_KEY)
        triggerArrayLengthIfNeeded(target, key, hadKey)
      }
      return result
    },
    deleteProperty(target: object, key: any) {
      if (readonly) {
        warnReadonly(key)
        return true
      }
      const had = Reflect.has(target, key)
      const result = Reflect.deleteProperty(target, key)
      if (had) {
        trigger(target, key)
        trigger(target, ITERATE_KEY)
      }
      return result
    },
    has(target: object, key: any) {
      track(target, ITERATE_KEY)
      return Reflect.has(target, key)
    },
    ownKeys(target: object) {
      track(target, ITERATE_KEY)
      return Reflect.ownKeys(target)
    }
  }
}

/** 数组代理 handlers：含修改/identity 方法 + 父级依赖通知 */
function createArrayHandlers(
  parent: { target: object; key: any } | null,
  readonly: boolean,
  shallow: boolean
) {
  return {
    get(target: object, key: any, receiver: any) {
      if (key === RAW) return target
      if (key === IS_REACTIVE) return !readonly
      if (key === IS_READONLY) return readonly
      if (key === IS_SHALLOW) return shallow

      if (key in identityInstrumentations) return identityInstrumentations[key]
      if (!readonly && key in mutatingInstrumentations)
        return mutatingInstrumentations[key]

      track(target, key)
      const value = Reflect.get(target, key, receiver)
      if (shallow) return value
      return shouldReactive(value)
        ? readonly
          ? readonlyProxy(value)
          : reactiveProxy(value)
        : value
    },
    set(target: object, key: any, value: any, receiver: any) {
      if (readonly) {
        warnReadonly(key)
        return true
      }
      const hadKey = Reflect.has(target, key)
      const oldValue = Reflect.get(target, key, receiver)
      const result = Reflect.set(target, key, value, receiver)
      if (result && oldValue !== value) {
        trigger(target, key)
        triggerArrayLengthIfNeeded(target, key, hadKey)
        // 数组内容变化 =》 通知读取了该数组的父级依赖（如 state.items）
        if (parent) trigger(parent.target, parent.key)
        if (!hadKey) trigger(target, ITERATE_KEY)
      }
      return result
    },
    deleteProperty(target: object, key: any) {
      if (readonly) {
        warnReadonly(key)
        return true
      }
      const had = Reflect.has(target, key)
      const result = Reflect.deleteProperty(target, key)
      if (had) {
        trigger(target, key)
        trigger(target, ITERATE_KEY)
        if (parent) trigger(parent.target, parent.key)
      }
      return result
    },
    has(target: object, key: any) {
      track(target, ITERATE_KEY)
      return Reflect.has(target, key)
    },
    ownKeys(target: object) {
      track(target, ITERATE_KEY)
      return Reflect.ownKeys(target)
    }
  }
}

// ------------------------------------------------------------
// 集合代理（Map / Set / WeakMap / WeakSet）
// ------------------------------------------------------------

function toReactiveValue(value: any): any {
  return shouldReactive(value) ? reactiveProxy(value) : value
}

function toReadonlyValue(value: any): any {
  return shouldReactive(value) ? readonlyProxy(value) : value
}

function createCollectionMethod(readonly: boolean, shallow: boolean) {
  const wrap = (value: any) =>
    readonly ? toReadonlyValue(value) : shallow ? value : toReactiveValue(value)

  const warn = (op: string) =>
    console.warn(`[actview] ${op} 失败：目标为只读集合`)

  return {
    get(this: any, key: any): any {
      const target = toRaw(this)
      track(target, key)
      return wrap(target.get(key))
    },
    set(this: any, key: any, value: any): any {
      const target = toRaw(this)
      if (readonly) {
        warn('set')
        return this
      }
      const hadKey = target.has(key)
      const oldValue = target.get(key)
      const result: any = target.set(key, value)
      if (!hadKey) {
        trigger(target, key)
        trigger(target, ITERATE_KEY)
      } else if (!Object.is(value, oldValue)) {
        trigger(target, key)
      }
      return result
    },
    add(this: any, value: any): any {
      const target = toRaw(this)
      if (readonly) {
        warn('add')
        return this
      }
      const hadKey = target.has(value)
      const result: any = target.add(value)
      if (!hadKey) {
        trigger(target, value)
        trigger(target, ITERATE_KEY)
      }
      return result
    },
    has(this: any, key: any): any {
      const target = toRaw(this)
      track(target, key)
      track(target, ITERATE_KEY)
      return target.has(key)
    },
    delete(this: any, key: any): any {
      const target = toRaw(this)
      if (readonly) {
        warn('delete')
        return false
      }
      const hadKey = target.has(key)
      const result: any = target.delete(key)
      if (hadKey) {
        trigger(target, key)
        trigger(target, ITERATE_KEY)
      }
      return result
    },
    clear(this: any): void {
      const target = toRaw(this)
      if (readonly) {
        warn('clear')
        return
      }
      let keys: any[] = []
      if (target instanceof Map) keys = Array.from(target.keys())
      else keys = Array.from(target.values())
      target.clear()
      trigger(target, ITERATE_KEY)
      for (const k of keys) trigger(target, k)
    },
    forEach(
      this: any,
      cb: (value: any, key: any, map: any) => void,
      thisArg?: any
    ): void {
      const target = toRaw(this)
      track(target, ITERATE_KEY)
      target.forEach((value: any, key: any) => {
        cb.call(thisArg, wrap(value), wrap(key), this)
      })
    },
    keys(this: any) {
      const target = toRaw(this)
      track(target, ITERATE_KEY)
      return wrapIterator(target.keys(), wrap)
    },
    values(this: any) {
      const target = toRaw(this)
      track(target, ITERATE_KEY)
      return wrapIterator(target.values(), wrap)
    },
    entries(this: any) {
      const target = toRaw(this)
      track(target, ITERATE_KEY)
      return wrapEntriesIterator(target.entries(), wrap)
    },
    [Symbol.iterator](this: any) {
      const target = toRaw(this)
      track(target, ITERATE_KEY)
      return target instanceof Map
        ? wrapEntriesIterator(target[Symbol.iterator](), wrap)
        : wrapIterator(target[Symbol.iterator](), wrap)
    }
  }
}

function wrapIterator(
  iterator: Iterator<any>,
  wrap: (v: any) => any
): IterableIterator<any> {
  return {
    [Symbol.iterator]() {
      return this
    },
    next() {
      const { value, done } = iterator.next()
      return done ? { value, done } : { value: wrap(value), done }
    }
  } as IterableIterator<any>
}

function wrapEntriesIterator(
  iterator: Iterator<any>,
  wrap: (v: any) => any
): IterableIterator<any> {
  return {
    [Symbol.iterator]() {
      return this
    },
    next() {
      const { value, done } = iterator.next()
      return done ? { value, done } : { value: [value[0], wrap(value[1])], done }
    }
  } as IterableIterator<any>
}

function createCollectionHandlers(readonly: boolean, shallow: boolean) {
  const methods = createCollectionMethod(readonly, shallow)

  return {
    get(target: object, key: any, receiver: any) {
      if (key === RAW) return target
      if (key === IS_REACTIVE) return !readonly
      if (key === IS_READONLY) return readonly
      if (key === IS_SHALLOW) return shallow

      if (key === 'size') {
        track(target, ITERATE_KEY)
        return Reflect.get(target, key, target)
      }

      if (key in methods) return (methods as any)[key]

      return Reflect.get(target, key, receiver)
    }
  }
}

// ------------------------------------------------------------
// 公开 API
// ------------------------------------------------------------

function createReactiveObject(
  target: object,
  isReadonly: boolean,
  isShallow: boolean
) {
  if (!shouldReactive(target)) return target
  // 已是代理：幂等返回；例外——readonly(reactive(obj)) 需再包一层只读
  if ((target as any)[RAW] && !(isReadonly && (target as any)[IS_REACTIVE])) {
    return target
  }

  const proxyMap = isReadonly
    ? isShallow
      ? shallowReadonlyMap
      : readonlyMap
    : isShallow
      ? shallowReactiveMap
      : reactiveMap
  const existing = proxyMap.get(target)
  if (existing) return existing

  const type = targetTypeMap(getRawType(target))
  const handlers =
    type === COLLECTION
      ? createCollectionHandlers(isReadonly, isShallow)
      : type === COMMON && Array.isArray(target)
        ? createArrayHandlers(null, isReadonly, isShallow)
        : createObjectHandlers(isReadonly, isShallow)

  const proxy = new Proxy(target, handlers)
  proxyMap.set(target, proxy)
  return proxy
}

function reactiveProxy<T extends object>(obj: T): T {
  return createReactiveObject(obj, false, false) as T
}

function readonlyProxy<T extends object>(obj: T): Readonly<T> {
  return createReactiveObject(obj, true, false) as Readonly<T>
}

/**
 * 深度响应式代理（reactive() 的返回类型）。
 *
 * 设计要点（对齐 Vue 3 的「结构透明」哲学）：
 *  - 交叉 `T & {...}`（而非 interface extends T——裸类型参数不能作接口基类，
 *    TS2430）：向下游完全兼容原始对象用法（读属性/展开/toRefs 无感知），
 *    所有把返回值当 T 用的既有代码零改动；
 *  - `'__v_isReactive'?: true`：与运行时标记（IS_REACTIVE，见文件顶部常量）
 *    呼应的正向品牌。**可选**属性 => 原始对象仍可赋给 `Reactive<T>` 形参
 *    （不破坏 assignability），它表达的是「工厂产出了什么」而非严格闸门；
 *    字面量字符串作键是因为运行时常量 IS_REACTIVE 无法在类型空间引用；
 *    （注意：仅在 strictNullChecks 下 `undefined` 才保留在标记键的类型里。）
 */
export type Reactive<T extends object> = T & {
  readonly '__v_isReactive'?: true
}

/** 浅层响应式代理（shallowReactive() 的返回类型）：仅第一层代理，嵌套保持原值 */
export type ShallowReactive<T extends object> = T & {
  readonly '__v_isShallow'?: true
}

/** 深度响应式：嵌套结构（对象/数组/集合）也响应式 */
export function reactive<T extends object>(obj: T): Reactive<T> {
  return reactiveProxy(obj) as Reactive<T>
}

/** 浅响应式：只代理第一层，嵌套对象保持原值（不被代理、不响应） */
export function shallowReactive<T extends object>(obj: T): ShallowReactive<T> {
  return createReactiveObject(obj, false, true) as ShallowReactive<T>
}

/** 只读（深度）：任何修改（含嵌套）被拦截并警告；可读、可被响应式跟踪 */
export function readonly<T extends object>(obj: T): Readonly<T> {
  return readonlyProxy(obj)
}

/** 浅只读代理（shallowReadonly() 的返回类型）：仅第一层只读，嵌套可写 */
export type ShallowReadonly<T extends object> = T & {
  readonly '__v_isShallow'?: true
  readonly '__v_isReadonly'?: true
}

/** 浅只读：仅第一层只读，嵌套可写 */
export function shallowReadonly<T extends object>(obj: T): ShallowReadonly<T> {
  return createReactiveObject(obj, true, true) as ShallowReadonly<T>
}
