// ============================================================
// @actview/core — 装饰器元数据存储与类型
//
// 装饰器只记录元数据；运行时的属性 accessor / computed / watch / provide
// 由 core/runtime 的 installReactiveApi / installLifecycle 安装。
// ============================================================

import type { WatchOptions } from '@actview/reactivity'
import type { ModelConstructor } from '../types/component'

/** 组件元数据 key（static 字段） */
export const META_KEY = '__actview_component_meta__'

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
export type WatchSource = string | string[] | ((this: any) => any)

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

/** @UseModel 元数据：字段名 → Model 类 token / qualifier */
export type ModelToken = ModelConstructor

/** Model 作用域：默认 per-component */
export type ModelScope = 'component' | 'inherited' | 'app'

/** @UseModel 的注入描述 */
export interface ModelRef {
  token: ModelToken
  name?: string
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
  models: Map<string, ModelRef>
  hooks: Partial<Record<LifecycleName, string[]>>
  setup?: string
  /** @Setup('pre' | 'after')：仅对 @Model 有意义，相对 owner 组件 @Setup */
  setupMode?: 'pre' | 'after'
  /** @Model 作用域（默认 component） */
  scope?: ModelScope
  /** @Named qualifier（Model） */
  modelName?: string
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
    models: new Map(),
    hooks: {},
  }
}

/** 取（或创建）某个类自己的元数据；装饰器阶段可能早于 @Component */
export function ownMeta(target: Function): ComponentMeta {
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
export function metaOf(target: object): ComponentMeta {
  const ctor = (target as { constructor?: Function }).constructor
  if (typeof ctor !== 'function') {
    throw new Error('[actview] 装饰器只能用于类成员')
  }
  return ownMeta(ctor)
}

/** 合并父类元数据与子类元数据（子类覆盖同名字段，hooks/watch 追加） */
export function mergeMeta(
  parent: ComponentMeta | undefined,
  own: ComponentMeta,
): ComponentMeta {
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
    models: new Map([...parent.models, ...own.models]),
    hooks,
    setup: own.setup ?? parent.setup,
    setupMode: own.setupMode ?? parent.setupMode,
    scope: own.scope ?? parent.scope,
    modelName: own.modelName ?? parent.modelName,
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
  const inherited = parent?.[META_KEY as keyof Function] as
    | ComponentMeta
    | undefined
  return inherited ?? createComponentMeta()
}
