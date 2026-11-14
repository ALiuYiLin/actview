// ============================================================
// @actview/core — @Component 类装饰器与 ActViewComponent 基类
// ============================================================

import {
  META_KEY,
  mergeMeta,
  ownMeta,
  type ComponentMeta,
  type ComponentOptions,
} from './meta'

/**
 * @Component 类装饰器：强制组件标记 + 校验 render + 合并/写入元数据。
 *
 * 用法：
 *   @Component({ name: 'Counter' })
 *   class Counter extends ActViewComponent<Props> { ... }
 */
export function Component(options: ComponentOptions = {}) {
  return function <T extends Function>(target: T): T {
    if (
      typeof (target as unknown as { prototype?: { render?: unknown } })
        .prototype?.render !== 'function'
    ) {
      throw new Error(
        `[actview] 类组件 "${target.name || 'Anonymous'}" 必须实现 render() 方法`,
      )
    }

    const parentCtor = Object.getPrototypeOf(target) as Function | null
    const parentMeta = parentCtor?.[META_KEY as keyof Function] as
      | ComponentMeta
      | undefined
    const own = ownMeta(target)
    if (own.setupMode) {
      throw new Error(
        `[actview] @Component "${target.name || 'Anonymous'}" 的 @Setup 不能带 pre/after；` +
          'pre/after 只用于 @Model，组件 @Setup 是基准点',
      )
    }
    if (own.scope || own.modelName) {
      throw new Error(
        `[actview] @Component "${target.name || 'Anonymous'}" 不能使用 @Scope/@Named；` +
          '@Scope/@Named 只用于 @Model',
      )
    }
    own.name = options.name ?? own.name
    if (options.inheritAttrs !== undefined) {
      own.inheritAttrs = options.inheritAttrs
    }
    own.render = 'render'
    const merged = mergeMeta(parentMeta, own)

    Object.defineProperty(target, META_KEY, {
      value: merged,
      configurable: true,
      writable: false,
      enumerable: false,
    })
    Object.defineProperty(target, '__actview_class_component', {
      value: true,
      configurable: true,
      writable: false,
      enumerable: false,
    })
    if (options.name) {
      Object.defineProperty(target, 'name', {
        value: options.name,
        configurable: true,
        writable: false,
        enumerable: false,
      })
    }
    return target
  }
}

/**
 * 类组件基类：只提供公开实例字段的类型声明与 render 约束。
 *
 * 运行时不产生字段（全部 declare），实例字段由渲染器 installProps /
 * installRefs / installPublicInstance 安装，因此不会遮蔽装饰器 accessor。
 */
export abstract class ActViewComponent<P = Record<string, any>> {
  /**
   * props 构造参数：让子类 JSX 标签类型能推导 props（无显式 constructor 时
   * 继承该签名）；运行时渲染器也会把 instance.props 传进来。
   */
  constructor(_props?: P) {
    void _props
  }

  declare readonly $props: P
  declare readonly $attrs: Record<string, any>
  declare readonly $el: Element | null
  declare readonly $: unknown
  declare readonly $parent: unknown
  declare readonly $root: unknown
  declare readonly $forceUpdate: () => void
  declare readonly $nextTick: <T = void>(fn?: () => T) => Promise<T>
  declare readonly $refs: Record<string, unknown>

  abstract render(): unknown
}
