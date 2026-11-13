// ============================================================
// @actview/core — installReactiveApi
//
// 读取装饰器元数据，安装 @Prop / @Ref / @Reactive / @Computed / @Inject /
// @Provide / @Watch 对应的实例字段与响应式行为。
// ============================================================

import { computed, reactive, ref, shallowReactive, watch } from '@actview/reactivity'
import type { WatchOptions } from '@actview/reactivity'
import type { ComponentMeta, WatchSource } from '../decorator/meta'
import type { ComponentInternalInstance } from './instance'
import { inject, provide } from './apiProvide'
/**
 * 安装声明字段的每实例 accessor：
 *   - @Prop：读 instance.props[key]（缺省时用 initializer 值做 fallback），只读；
 *   - @Ref：闭包持有一个真正 ref，get/set 与 this.count ≈ count.value 等价；
 *   - @Reactive：对象 / 数组字段变成 reactive（或 shallowReactive）代理；
 *   - @Inject：setup 期解析一次注入值，写入实例字段。
 *
 * 先摘掉 class field initializer 产生的 own data property，再安装 accessor。
 */
export function installDeclaredFields(
  ctx: Record<string, any>,
  instance: ComponentInternalInstance,
  meta: ComponentMeta,
  options: { bindProps?: boolean } = {},
): void {
  const props = instance.props as Record<string, any>

  if (options.bindProps !== false) {
    for (const key of meta.props.keys()) {
      const own = Object.getOwnPropertyDescriptor(ctx, key)
      const fallback = own?.value
      if (own) delete ctx[key]
      Object.defineProperty(ctx, key, {
        configurable: true,
        enumerable: true,
        get: () => (key in props ? props[key] : fallback),
        set: () => {
          throw new Error(
            `[actview] prop "${String(key)}" 是只读的（由父组件传入）`,
          )
        },
      })
    }
  }

  for (const key of meta.refs.keys()) {
    const own = Object.getOwnPropertyDescriptor(ctx, key)
    const initial = own?.value
    if (own) delete ctx[key]
    const r = ref(initial)
    Object.defineProperty(ctx, key, {
      configurable: true,
      enumerable: true,
      get: () => r.value,
      set: (value: unknown) => {
        r.value = value
      },
    })
  }

  for (const [key, options] of meta.reactive) {
    const own = Object.getOwnPropertyDescriptor(ctx, key)
    const initial = own?.value
    if (own) delete ctx[key]
    let state = toReactive(initial, options)
    Object.defineProperty(ctx, key, {
      configurable: true,
      enumerable: true,
      get: () => state,
      set: (value: unknown) => {
        state = toReactive(value, options)
      },
    })
  }

  for (const entry of meta.injects) {
    const own = Object.getOwnPropertyDescriptor(ctx, entry.property)
    const fallback = entry.default !== undefined ? entry.default : own?.value
    if (own) delete ctx[entry.property]
    const value = inject(entry.key, fallback)
    Object.defineProperty(ctx, entry.property, {
      configurable: true,
      enumerable: true,
      writable: true,
      value,
    })
  }
}

/** 对象 → reactive / shallowReactive；原始值原样返回（@Reactive 设计为对象字段） */
function toReactive(value: unknown, options: { shallow?: boolean }): unknown {
  if (value !== null && typeof value === 'object') {
    return options.shallow ? shallowReactive(value as object) : reactive(value as object)
  }
  return value
}

/** 安装 @Computed：每实例一个 computed，惰性求值 + 缓存 */
export function installComputed(
  ctx: Record<string, any>,
  meta: ComponentMeta,
): void {
  for (const [key, getter] of meta.computed) {
    const cache = computed(() => getter.call(ctx))
    Object.defineProperty(ctx, key, {
      configurable: true,
      enumerable: false,
      get: () => cache.value,
    })
  }
}

/** 安装 @Provide：在 @Setup 之后把字段当前值写入注入表 */
export function installProvides(
  ctx: Record<string, any>,
  meta: ComponentMeta,
): void {
  for (const entry of meta.provides) {
    provide(entry.key, ctx[entry.property])
  }
}

/**
 * 安装 @Watch：每项注册到实例 scope，组件卸载时随 scope 自动停止。
 *
 * source 支持字段名 / 字段名数组 / getter；handler 是实例方法。
 */
export function installWatches(
  ctx: Record<string, any>,
  meta: ComponentMeta,
): void {
  for (const entry of meta.watch) {
    const getter = buildWatchGetter(ctx, entry.source)
    watch(
      getter as () => any,
      (value: any, oldValue: any, onCleanup: any) => {
        const handler = ctx[entry.method]
        if (typeof handler === 'function') {
          handler.call(ctx, value, oldValue, onCleanup)
        }
      },
      entry.options,
    )
  }
}

/** 把 @Watch source 转成 watch 可消费的 getter（数组 → getter 数组） */
function buildWatchGetter(
  ctx: Record<string, any>,
  source: WatchSource,
): (() => any) | Array<() => any> {
  const toGetter = (item: string | ((this: any) => any)): (() => any) =>
    typeof item === 'function' ? () => item.call(ctx) : () => ctx[item]

  return Array.isArray(source)
    ? source.map((item) => toGetter(item))
    : toGetter(source)
}


