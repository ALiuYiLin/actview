import {
  track,
  trigger,
  pauseTracking,
  resetTracking
} from '../runtime/reactive-system'

// ============================================================
// 数组方法 instrumentation
//   state.items.push(x) 等修改数组内容后，需要触发"读取了该数组"的依赖：
//   1) 数组自身的 length/索引依赖（代理 set 会触发）
//   2) 父级对象依赖（如 state.items）——数组代理 set 会通知
// ============================================================

const MUTATING_ARRAY_METHODS = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
] as const

/** 包装后的修改方法：用原始实现调用（this 是数组代理），
 *  内部对 length/索引的写入会走代理 set =》 触发数组自身与父级依赖；
 *  执行期间 pauseTracking：不把修改过程内部读取收集进当前 effect */
const arrayInstrumentations: Record<string, (...args: any[]) => any> = {}
MUTATING_ARRAY_METHODS.forEach((method) => {
  arrayInstrumentations[method] = function (this: any, ...args: any[]) {
    pauseTracking()
    const res = (Array.prototype as any)[method].apply(this, args)
    resetTracking()
    return res
  }
})

// ============================================================
// 可代理性判定
//   只代理「普通对象 / 数组」；Date、Map、Set、class 实例、DOM 等
//   原生类型内部依赖槽位，包代理会运行时崩溃，直接返回原值。
//   markRaw 标记的对象永不代理。
// ============================================================

const rawSet = new WeakSet<object>()

/** 标记对象为「原始值」：reactive/readonly 遇到它时跳过代理 */
export function markRaw<T extends object>(obj: T): T {
  rawSet.add(obj)
  return obj
}

function isPlainObject(v: any): boolean {
  // null / 非对象（含 undefined，如访问 toJSON 等 symbol 属性时）不判为普通对象
  if (v === null || typeof v !== 'object') return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

/** 是否应对该值做响应式代理 */
function shouldProxy(v: any): boolean {
  return (
    (Array.isArray(v) || isPlainObject(v)) &&
    !rawSet.has(v) &&
    !(v as any).__v_skip && // Vue 3：__v_skip 标记的对象跳过代理
    Object.isExtensible(v) // Vue 3：非可扩展对象不代理
  )
}

function warnReadonly(key: PropertyKey) {
  console.warn(`[actview] readonly 对象不允许修改: ${String(key)}`)
}

/** 惰性深层代理的缓存（按代理类型分开） */
const reactiveMap = new WeakMap<object, any>()
const shallowMap = new WeakMap<object, any>()
const readonlyMap = new WeakMap<object, any>()
/** 已创建的响应式代理集合：reactive(proxy) 幂等返回原代理 */
const proxySet = new WeakSet<object>()

/** 迭代键：代表「对象的 key 集合」，用于 for...in / in 操作的依赖 */
const ITERATE_KEY = Symbol('iterate')

/** 数组整数索引 key（'0'/'12' 等；'length'/'foo' 不是） */
const isIntegerKey = (key: PropertyKey) =>
  typeof key === 'string' &&
  key !== 'NaN' &&
  key[0] !== '-' &&
  String(parseInt(key, 10)) === key

/** 数组新增整数索引时：length 自动同步，set('length') 检测不到变化，需显式触发 */
function triggerArrayLengthIfNeeded(
  target: any,
  key: PropertyKey,
  hadKey: boolean
) {
  if (!hadKey && Array.isArray(target) && isIntegerKey(key)) {
    trigger(target, 'length')
  }
}

// ============================================================
// 数组代理（响应式 / 只读）
// ============================================================

/** 响应式数组代理：拦截修改方法 + 索引/length 变更时通知父级 */
function createArrayProxy(
  raw: any[],
  parent: { target: object; key: PropertyKey }
): any[] {
  const proxy = new Proxy(raw, {
    /* 在 handlers 定义后登记到 proxySet */
    get(target, key, receiver) {
      // 修改方法返回 instrumented 包装（this 绑定为数组代理）
      if (typeof key === 'string' && key in arrayInstrumentations) {
        return arrayInstrumentations[key]
      }
      track(target, key)
      const value = Reflect.get(target, key, receiver)
      return shouldProxy(value) ? reactive(value) : value
    },
    set(target, key, value, receiver) {
      const hadKey = Reflect.has(target, key)
      const oldValue = Reflect.get(target, key, receiver)
      const result = Reflect.set(target, key, value, receiver)
      if (result && oldValue !== value) {
        trigger(target, key)
        triggerArrayLengthIfNeeded(target, key, hadKey)
        // 数组内容变化 =》 通知读取了该数组的父级依赖（如 state.items）
        trigger(parent.target, parent.key)
        // 新增 key（如 push 的新索引）=》 通知迭代依赖
        if (!hadKey) trigger(target, ITERATE_KEY)
      }
      return result
    },
    deleteProperty(target, key) {
      const had = Reflect.has(target, key)
      const result = Reflect.deleteProperty(target, key)
      if (had) {
        trigger(target, key)
        trigger(target, ITERATE_KEY)
        trigger(parent.target, parent.key)
      }
      return result
    },
    // for...in / in 数组：依赖 key 集合
    has(target, key) {
      track(target, ITERATE_KEY)
      return Reflect.has(target, key)
    },
    ownKeys(target) {
      track(target, ITERATE_KEY)
      return Reflect.ownKeys(target)
    }
  })
  proxySet.add(proxy)
  return proxy
}

/** 只读数组代理：可读可遍历，修改被拦截并警告 */
function createReadonlyArrayProxy(raw: any[]): any[] {
  const proxy = new Proxy(raw, {
    get(target, key, receiver) {
      track(target, key)
      const value = Reflect.get(target, key, receiver)
      return shouldProxy(value) ? readonly(value) : value
    },
    set(_target, key) {
      warnReadonly(key)
      return true
    },
    deleteProperty(_target, key) {
      warnReadonly(key)
      return true
    },
    has(target, key) {
      track(target, ITERATE_KEY)
      return Reflect.has(target, key)
    },
    ownKeys(target) {
      track(target, ITERATE_KEY)
      return Reflect.ownKeys(target)
    }
  })
  return proxy
}

// ============================================================
// 对象代理（深度响应式 / 浅响应式 / 只读）
// ============================================================

function createObjectHandlers(deep: boolean) {
  return {
    get(target: object, key: PropertyKey, receiver: any) {
      track(target, key)
      const value = Reflect.get(target, key, receiver)
      if (!deep) return value // shallow：不包嵌套对象
      if (Array.isArray(value)) return createArrayProxy(value, { target, key })
      return shouldProxy(value) ? reactive(value) : value
    },
    set(target: object, key: PropertyKey, value: any, receiver: any) {
      const hadKey = Reflect.has(target, key)
      const oldValue = Reflect.get(target, key, receiver)
      const result = Reflect.set(target, key, value, receiver)
      if (result && oldValue !== value) {
        trigger(target, key)
        // 新增 key =》 影响 for...in 遍历结果
        if (!hadKey) trigger(target, ITERATE_KEY)
        triggerArrayLengthIfNeeded(target, key, hadKey)
      }
      return result
    },
    deleteProperty(target: object, key: PropertyKey) {
      const had = Reflect.has(target, key)
      const result = Reflect.deleteProperty(target, key)
      if (had) {
        trigger(target, key)
        trigger(target, ITERATE_KEY)
      }
      return result
    },
    // for...in / key in obj：依赖 key 集合，增删 key 时触发
    has(target: object, key: PropertyKey) {
      track(target, ITERATE_KEY)
      return Reflect.has(target, key)
    },
    ownKeys(target: object) {
      track(target, ITERATE_KEY)
      return Reflect.ownKeys(target)
    }
  }
}

function createReadonlyObjectHandlers() {
  return {
    get(target: object, key: PropertyKey, receiver: any) {
      track(target, key)
      const value = Reflect.get(target, key, receiver)
      if (Array.isArray(value)) return createReadonlyArrayProxy(value)
      return shouldProxy(value) ? readonly(value) : value
    },
    set(_target: object, key: PropertyKey) {
      warnReadonly(key)
      return true
    },
    deleteProperty(_target: object, key: PropertyKey) {
      warnReadonly(key)
      return true
    },
    has(target: object, key: PropertyKey) {
      track(target, ITERATE_KEY)
      return Reflect.has(target, key)
    },
    ownKeys(target: object) {
      track(target, ITERATE_KEY)
      return Reflect.ownKeys(target)
    }
  }
}

// ============================================================
// 公开 API
// ============================================================

/** 深度响应式：普通对象 / 数组的嵌套结构也响应式 */
export function reactive<T extends object>(obj: T): T {
  if (!shouldProxy(obj)) return obj
  if (proxySet.has(obj)) return obj // 已是响应式代理：幂等返回
  const cached = reactiveMap.get(obj)
  if (cached) return cached as T
  const proxy = new Proxy(obj, createObjectHandlers(true)) as T
  reactiveMap.set(obj, proxy)
  proxySet.add(proxy)
  return proxy
}

/** 浅响应式：只代理第一层，嵌套对象保持原值（不被代理、不响应） */
export function shallowReactive<T extends object>(obj: T): T {
  if (!shouldProxy(obj)) return obj
  const cached = shallowMap.get(obj)
  if (cached) return cached as T
  const proxy = new Proxy(obj, createObjectHandlers(false)) as T
  shallowMap.set(obj, proxy)
  return proxy
}

/** 只读（深度）：任何修改（含嵌套）被拦截并警告；可读、可被响应式跟踪 */
export function readonly<T extends object>(obj: T): Readonly<T> {
  if (!shouldProxy(obj)) return obj as Readonly<T>
  const cached = readonlyMap.get(obj)
  if (cached) return cached as Readonly<T>
  const proxy = new Proxy(obj, createReadonlyObjectHandlers()) as Readonly<T>
  readonlyMap.set(obj, proxy)
  return proxy
}
