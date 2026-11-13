// ============================================================
// @actview/core — 响应式 / 注入类装饰器
//
// @Prop / @Ref / @Reactive / @Computed / @Watch / @Provide / @Inject
// 只记录元数据；真正的属性 accessor / computed / watch / provide 由
// core/runtime 的 installReactiveApi 在实例创建后安装。
// ============================================================

import type { WatchOptions } from '@actview/reactivity'
import {
  metaOf,
  type PropOptions,
  type ProvideMeta,
  type ReactiveOptions,
  type RefOptions,
  type WatchSource,
} from './meta'

/** @Prop 属性装饰器：渲染器把字段映射为 instance.props[key] 的只读访问器 */
export function Prop(target: object, key: string | symbol): void
export function Prop(options?: PropOptions): PropertyDecorator
export function Prop(
  targetOrOptions?: object | PropOptions,
  key?: string | symbol,
): void | PropertyDecorator {
  if (key !== undefined) {
    metaOf(targetOrOptions as object).props.set(String(key), {})
    return
  }
  const options = (targetOrOptions as PropOptions | undefined) ?? {}
  return (target: object, propertyKey: string | symbol): void => {
    metaOf(target).props.set(String(propertyKey), options)
  }
}

/** @Ref 属性装饰器：渲染器构造后安装每实例 ref accessor */
export function Ref(target: object, key: string | symbol): void
export function Ref(options?: RefOptions): PropertyDecorator
export function Ref(
  targetOrOptions?: object | RefOptions,
  key?: string | symbol,
): void | PropertyDecorator {
  if (key !== undefined) {
    metaOf(targetOrOptions as object).refs.set(String(key), {})
    return
  }
  const options = (targetOrOptions as RefOptions | undefined) ?? {}
  return (target: object, propertyKey: string | symbol): void => {
    metaOf(target).refs.set(String(propertyKey), options)
  }
}

/** @Reactive 属性装饰器：把对象 / 数组字段变成 reactive / shallowReactive */
export function Reactive(target: object, key: string | symbol): void
export function Reactive(options?: ReactiveOptions): PropertyDecorator
export function Reactive(
  targetOrOptions?: object | ReactiveOptions,
  key?: string | symbol,
): void | PropertyDecorator {
  if (key !== undefined) {
    metaOf(targetOrOptions as object).reactive.set(String(key), {})
    return
  }
  const options = (targetOrOptions as ReactiveOptions | undefined) ?? {}
  return (target: object, propertyKey: string | symbol): void => {
    metaOf(target).reactive.set(String(propertyKey), options)
  }
}

/** @Computed getter 装饰器：按实例创建 computed（惰性求值 + 缓存） */
export function Computed(
  target: object,
  key: string,
  descriptor: PropertyDescriptor,
): void {
  const getter = descriptor.get
  if (typeof getter !== 'function') {
    throw new Error(
      `[actview] @Computed 只能用于 getter（当前 "${key}" 不是 getter）`,
    )
  }
  metaOf(target).computed.set(key, getter)
}

/**
 * @Watch(source, options?) 方法装饰器：
 *   @Watch('count') onCount(value, oldValue) {}
 *   @Watch(() => this.count > 3) onBig() {}
 */
export function Watch(source: WatchSource, options?: WatchOptions) {
  return function (
    target: object,
    key: string,
    _descriptor?: PropertyDescriptor,
  ): void {
    metaOf(target).watch.push({ source, method: key, options })
  }
}

/** @Provide 属性装饰器：把字段值 provide 给后代（key 默认 = 字段名） */
export function Provide(target: object, key: string | symbol): void
export function Provide(key?: PropertyKey): PropertyDecorator
export function Provide(
  targetOrKey?: object | PropertyKey,
  key?: string | symbol,
): void | PropertyDecorator {
  // 直接使用：@Provide（legacy 属性装饰器会传 target + propertyKey）
  if (key !== undefined && typeof targetOrKey === 'object') {
    metaOf(targetOrKey).provides.push({
      key: String(key),
      property: String(key),
    } satisfies ProvideMeta)
    return
  }
  // 工厂：@Provide() / @Provide('alias')
  const providedKey = targetOrKey as PropertyKey | undefined
  return (target: object, propertyKey: string | symbol): void => {
    metaOf(target).provides.push({
      key: providedKey ?? propertyKey,
      property: String(propertyKey),
    })
  }
}

/**
 * @Inject(key?, default?) 属性装饰器：从祖先注入值（setup 期解析一次）。
 *   @Inject('theme') theme!: string
 *   @Inject('missing', 'fallback') value = 'default'
 */
export function Inject(
  key?: PropertyKey,
  defaultValue?: unknown,
): PropertyDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    metaOf(target).injects.push({
      key: key ?? propertyKey,
      property: String(propertyKey),
      default: defaultValue,
    })
  }
}
