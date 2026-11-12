// ============================================================
// @actview/core — 类组件装饰器
//
//   - @Component 强制显式标记类组件；
//   - @Prop / @Ref / @Reactive / @Computed / @Watch / @Provide / @Inject
//     只记录元数据；真正的属性访问器 / computed / watch / provide 由渲染器
//     在实例创建后安装（避免 ES2022 class field define 语义遮蔽原型
//     accessor，也避免 Proxy 的 #private / this 绑定问题）；
//   - 生命周期装饰器只记录方法名，渲染器在实例挂载时注册到现有 hooks 数组。
// ============================================================

import {
  computed,
  reactive,
  shallowReactive,
  watch,
  type WatchOptions,
} from '@actview/reactivity'

/** 组件元数据 key（static 字段） */
const META_KEY = '__actview_component_meta__'

/** 生命周期方法名（与 core instance 的 hooks 数组一致） */
export type LifecycleName =
  | 'beforeMount'
  | 'mounted'
  | 'beforeUpdate'
  | 'updated'
  | 'beforeUnmount'
  | 'unmounted'
  | 'activated'
  | 'deactivated'

/** @Ref 选项（第一版只保留 deep；默认深响应式） */
export interface RefOptions {
  deep?: boolean
}

/** @Prop 选项（第一版：default 仅用于文档；运行时默认值取字段 initializer） */
export interface PropOptions {
  default?: unknown
}

/** @Reactive 选项 */
export interface ReactiveOptions {
  /** true 时使用 shallowReactive（默认深响应式） */
  shallow?: boolean
}

/** @Watch 监听源：字段名 / 字段名数组 / getter */
export type WatchSource =
  | string
  | string[]
  | ((this: any) => any)

/** @Watch 元数据 */
export interface WatchMeta {
  source: WatchSource
  method: string
  options?: WatchOptions
}

/** @Provide 元数据 */
export interface ProvideMeta {
  key: PropertyKey
  property: string
}

/** @Inject 元数据 */
export interface InjectMeta {
  key: PropertyKey
  property: string
  default?: unknown
}

/** 类组件元数据 */
export interface ComponentMeta {
  name?: string
  refs: Map<string, RefOptions>
  props: Map<string, PropOptions>
  reactive: Map<string, ReactiveOptions>
  computed: Map<string, () => any>
  watch: WatchMeta[]
  provides: ProvideMeta[]
  injects: InjectMeta[]
  hooks: Partial<Record<LifecycleName, string[]>>
  setup?: string
  render?: string
}

/** @Component 选项 */
export interface ComponentOptions {
  name?: string
}

/** 创建空元数据 */
export function createComponentMeta(): ComponentMeta {
  return {
    refs: new Map(),
    props: new Map(),
    reactive: new Map(),
    computed: new Map(),
    watch: [],
    provides: [],
    injects: [],
    hooks: {},
  }
}

/** 取（或创建）某个类自己的元数据；装饰器阶段可能早于 @Component */
function ownMeta(target: Function): ComponentMeta {
  const ctor = target as unknown as Record<string, unknown>
  const existing = ctor[META_KEY] as ComponentMeta | undefined
  if (existing) return existing
  const meta = createComponentMeta()
  Object.defineProperty(ctor, META_KEY, {
    value: meta,
    configurable: true,
    writable: false,
    enumerable: false,
  })
  return meta
}

/** 从 prototype / constructor 解析所属类的元数据 */
function metaOf(target: object): ComponentMeta {
  const ctor = (target as { constructor?: Function }).constructor
  if (typeof ctor !== 'function') {
    throw new Error('[actview] 装饰器只能用于类成员')
  }
  return ownMeta(ctor)
}

/** 合并父类元数据与子类元数据（子类覆盖同名字段，hooks/watch 追加） */
function mergeMeta(parent: ComponentMeta | undefined, own: ComponentMeta): ComponentMeta {
  if (!parent) return own
  const hooks: Partial<Record<LifecycleName, string[]>> = { ...parent.hooks }
  for (const [name, methods] of Object.entries(own.hooks) as Array<
    [LifecycleName, string[]]
  >) {
    hooks[name] = [...(hooks[name] ?? []), ...methods]
  }
  return {
    name: own.name ?? parent.name,
    refs: new Map([...parent.refs, ...own.refs]),
    props: new Map([...parent.props, ...own.props]),
    reactive: new Map([...parent.reactive, ...own.reactive]),
    computed: new Map([...parent.computed, ...own.computed]),
    watch: [...parent.watch, ...own.watch],
    provides: [...parent.provides, ...own.provides],
    injects: [...parent.injects, ...own.injects],
    hooks,
    setup: own.setup ?? parent.setup,
    render: own.render ?? parent.render,
  }
}

/**
 * 读取类组件元数据（渲染器使用）。
 * @Component 未使用时返回空元数据（但 isClassComponent 也会是 false）。
 */
export function getComponentMeta(ctor: Function): ComponentMeta {
  const own = (ctor as unknown as Record<string, unknown>)[META_KEY] as
    | ComponentMeta
    | undefined
  if (own) return own
  const parent = Object.getPrototypeOf(ctor) as Function | null
  const inherited = parent?.[
    META_KEY as keyof Function
  ] as ComponentMeta | undefined
  return inherited ?? createComponentMeta()
}

/**
 * @Component 类装饰器：强制组件标记 + 校验 render + 合并/写入元数据。
 *
 * 用法：
 *   @Component({ name: 'Counter' })
 *   class Counter extends ActViewComponent<Props> { ... }
 */
export function Component(options: ComponentOptions = {}) {
  return function <T extends Function>(target: T): T {
    if (typeof (target as unknown as { prototype?: { render?: unknown } }).prototype?.render !== 'function') {
      throw new Error(
        `[actview] 类组件 "${target.name || 'Anonymous'}" 必须实现 render() 方法`,
      )
    }

    const parentCtor = Object.getPrototypeOf(target) as Function | null
    const parentMeta = parentCtor?.[
      META_KEY as keyof Function
    ] as ComponentMeta | undefined
    const own = ownMeta(target)
    own.name = options.name ?? own.name
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
    })
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

/** @Setup 方法装饰器：实例创建后、首帧前执行一次 */
export function Setup(
  target: object,
  key: string,
  _descriptor?: PropertyDescriptor,
): void {
  metaOf(target).setup = key
}

function lifecycleHook(name: LifecycleName) {
  return function (
    target: object,
    key: string,
    _descriptor?: PropertyDescriptor,
  ): void {
    const meta = metaOf(target)
    ;(meta.hooks[name] ??= []).push(key)
  }
}

export const BeforeMount = lifecycleHook('beforeMount')
export const Mounted = lifecycleHook('mounted')
export const BeforeUpdate = lifecycleHook('beforeUpdate')
export const Updated = lifecycleHook('updated')
export const BeforeUnmount = lifecycleHook('beforeUnmount')
export const Unmounted = lifecycleHook('unmounted')
export const Activated = lifecycleHook('activated')
export const Deactivated = lifecycleHook('deactivated')

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
  declare readonly $el: Element | null
  declare readonly $: unknown
  declare readonly $parent: unknown
  declare readonly $root: unknown
  declare readonly $forceUpdate: () => void
  declare readonly $nextTick: <T = void>(fn?: () => T) => Promise<T>
  declare readonly $refs: Record<string, unknown>

  abstract render(): unknown
}
