// ============================================================
// provide / inject（M2，docs/renderer-design.md §10）
//
// 语义（对齐 Vue 3）：
//   - provide(key, value) 只能在该组件 setup 内调用：写入【当前实例】的
//     注入表，只对本组件的后代可见（祖先 / 兄弟不可见）；
//   - 注入表默认是继承引用：createComponentInstance 里 injects = 父实例
//     injects（根组件 = appContext.provides）。因此未 provide 的组件之间
//     零拷贝共享同一张表；
//   - 首次 provide 时 copy-on-write：先把继承来的表浅拷贝成自己的副本再写，
//     否则会污染父 / 兄弟组件的注入表；
//   - inject(key, default?) 读当前实例的注入表：key 存在（own property）→
//     返回注入值，否则返回 defaultValue（未传则为 undefined）。
//
// 响应式：provide/inject 原样存储 / 返回对象，框架不做包装——需要响应式时
// 传入 reactive 对象 / ref，并在 render 内读取。
// ============================================================

import { getCurrentInstance } from './lifecycle'
import type { ComponentInternalInstance } from './instance'

const hasOwnProperty = Object.prototype.hasOwnProperty

/** provide / inject 只能在 setup 内调用时的统一错误信息 */
function currentInstanceFor(api: string): ComponentInternalInstance {
  const instance = getCurrentInstance()
  if (!instance) {
    throw new Error(
      `[actview] ${api} 只能在组件 setup() 中调用` +
        `（当前没有正在执行的组件实例）`,
    )
  }
  return instance
}

/**
 * 提供注入值（只能在 setup 内调用）。
 *
 * 首次 provide 时 copy-on-write 当前注入表：保证子组件 provide 不会改写
 * 父 / 兄弟组件的表（惰性拷贝 = 共享路径零开销）。
 */
export function provide<T>(key: PropertyKey, value: T): void {
  const instance = currentInstanceFor('provide()')

  const inherited =
    (instance.parent !== null && instance.injects === instance.parent.injects) ||
    instance.injects === instance.appContext.provides
  if (inherited) {
    instance.injects = { ...instance.injects }
  }

  instance.injects[key] = value
}

/**
 * 读取注入值（只能在 setup 内调用）。
 *
 * 沿实例的注入表（已包含整条祖先链 + app.provide）查找 key；
 * 未提供时返回 defaultValue（未传 → undefined，与「注入了 undefined」区分：
 * 显式注入 undefined 时返回 undefined 而非 default）。
 */
export function inject<T>(key: PropertyKey, defaultValue?: T): T | undefined {
  const instance = currentInstanceFor('inject()')
  const injects = instance.injects
  // PropertyKey 含 number（hasOwn 的类型守卫只收 string | symbol），
  // 直接用 hasOwnProperty.call 判定 own property（含 Symbol key）
  return hasOwnProperty.call(injects, key)
    ? (injects[key] as T)
    : defaultValue
}
