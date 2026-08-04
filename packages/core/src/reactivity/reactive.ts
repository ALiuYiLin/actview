import { track, trigger } from "../runtime/reactive-system"

/** 迭代键：代表「对象的 key 集合」，用于 for...in / in 操作的依赖 */
const ITERATE_KEY = Symbol('iterate')

// ============================================================
// 数组方法 instrumentation
//   state.items.push(x) 等修改数组内容后，需要触发"读取了该数组"的依赖：
//   1) 数组自身的 length/索引依赖（代理 set 会触发）
//   2) 父级对象依赖（如 (state, 'items')）——通过 parentMap 关联触发
// ============================================================

const MUTATING_ARRAY_METHODS = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'] as const

/** 包装后的修改方法：用原始实现调用（this 是数组代理），
 *  内部对 length/索引的写入会走代理 set =》 触发数组自身与父级依赖 */
const arrayInstrumentations: Record<string, (...args: any[]) => any> = {}
MUTATING_ARRAY_METHODS.forEach((method) => {
  arrayInstrumentations[method] = function (this: any, ...args: any[]) {
    return (Array.prototype as any)[method].apply(this, args)
  }
})

/** 惰性深层代理的缓存（对象级） */
const proxyMap = new WeakMap<object, any>()

function isObject(v: any): v is object {
  return v !== null && typeof v === 'object'
}

/** 数组专用代理：拦截修改方法 + 索引/length 变更时通知父级 */
function createArrayProxy(raw: any[], parent: { target: object; key: PropertyKey }): any[] {
  const proxy = new Proxy(raw, {
    get(target, key, receiver) {
      // 修改方法返回 instrumented 包装（this 绑定为数组代理）
      if (typeof key === 'string' && key in arrayInstrumentations) {
        return arrayInstrumentations[key]
      }
      track(target, key)
      const value = Reflect.get(target, key, receiver)
      return isObject(value) ? reactive(value) : value
    },
    set(target, key, value, receiver) {
      const hadKey = Reflect.has(target, key)
      const oldValue = Reflect.get(target, key, receiver)
      const result = Reflect.set(target, key, value, receiver)
      if (oldValue !== value) {
        trigger(target, key)
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
    },
  })
  return proxy
}

// ============================================================
// reactive — 惰性深层代理
// ============================================================

export function reactive<T extends object>(obj: T): T {
  const cached = proxyMap.get(obj)
  if (cached) return cached as T

  const proxy = new Proxy(obj, {
    get(target, key, receiver) {
      track(target, key)
      const value = Reflect.get(target, key, receiver)
      // 惰性深层代理：嵌套对象/数组也响应式
      // 数组用专用代理（含方法 instrumentation 与父级依赖通知）
      if (Array.isArray(value)) {
        return createArrayProxy(value, { target, key })
      }
      return isObject(value) ? reactive(value) : value
    },
    set(target, key, value, receiver) {
      const hadKey = Reflect.has(target, key)
      const oldValue = Reflect.get(target, key, receiver)
      const result = Reflect.set(target, key, value, receiver)
      if (oldValue !== value) {
        trigger(target, key)
        // 新增 key =》 影响 for...in 遍历结果
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
      }
      return result
    },
    // for...in / key in obj：依赖 key 集合，增删 key 时触发
    has(target, key) {
      track(target, ITERATE_KEY)
      return Reflect.has(target, key)
    },
    ownKeys(target) {
      track(target, ITERATE_KEY)
      return Reflect.ownKeys(target)
    },
  })

  proxyMap.set(obj, proxy)
  return proxy as T
}
