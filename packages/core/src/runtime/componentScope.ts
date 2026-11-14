// ============================================================
// @actview/core — ComponentScope
//
// 每个组件实例一个 scope：
//   component  → 当前组件一份
//   inherited  → 最近祖先已有则复用；没有则当前组件创建
//   app        → AppContext 级一份（见 resolveAppModel）
//
// 生命周期只属于创建实例的 owner；inherited 消费者不重复 setup/hooks。
// ============================================================

import { EffectScope, pauseTracking, resetTracking } from '@actview/reactivity'
import { getComponentMeta } from '../decorator'
import type {
  ComponentMeta,
  LifecycleName,
  ModelScope,
  ModelToken,
} from '../decorator'
import { setCurrentInstance } from '../lifecycle'
import { isModel } from '../types/component'
import type {
  AppContext,
  ComponentInternalInstance,
} from './instance'
import {
  installComputed,
  installDeclaredFields,
  installProvides,
  installWatches,
} from './installReactiveApi'

/** 先于 owner 执行的阶段 */
const MODEL_FIRST_PHASES: LifecycleName[] = [
  'beforeMount',
  'mounted',
  'beforeUpdate',
  'updated',
  'activated',
]

/** 后于 owner 执行的阶段 */
const OWNER_FIRST_PHASES: LifecycleName[] = [
  'deactivated',
  'beforeUnmount',
  'unmounted',
]

interface ModelEntry {
  token: ModelToken
  name: string
  data: Record<string, any>
  meta: ComponentMeta
  phase: 'pre' | 'after'
  deps: Set<ModelEntry>
  setupDone: boolean
  runtimeDone: boolean
  /** inherited 复用：不执行 setup / hooks，不进入当前组件的 order */
  borrowed: boolean
}

export class ComponentScope {
  readonly owner: ComponentInternalInstance

  private readonly instances = new Map<ModelToken, Map<string, object>>()
  private readonly entries = new Map<ModelToken, Map<string, ModelEntry>>()
  private readonly resolving: ModelEntry[] = []
  private readonly order: ModelEntry[] = []
  private readonly dataHooks: Partial<Record<LifecycleName, Array<() => void>>> =
    {}

  constructor(owner: ComponentInternalInstance) {
    this.owner = owner
  }

  /** 解析 Model；name 为 @UseModel 的 qualifier / @Named */
  resolve<T extends object>(token: ModelToken, name?: string): T {
    if (!isModel(token)) {
      throw new Error(
        `[actview] @UseModel token 不是 @Model 类：${String(token)}`,
      )
    }

    const meta = getComponentMeta(token)
    const qualifier = name ?? meta.modelName ?? ''
    const scope = meta.scope ?? 'component'

    const cached = this.getEntry(token, qualifier)
    if (cached) {
      this.linkParent(cached)
      return cached.data as T
    }

    if (scope === 'inherited') {
      const inherited = this.findInherited(token, qualifier)
      if (inherited) {
        const entry = this.borrow(token, qualifier, inherited.data, meta)
        this.linkParent(entry)
        return entry.data as T
      }
    }

    if (scope === 'app') {
      return this.resolveAppModel(token, qualifier, meta) as T
    }

    return this.createLocal(token, qualifier, meta) as T
  }

  /** 在祖先组件 scope 中查找同 token / name 的实例 */
  findInstance(token: ModelToken, name: string): object | undefined {
    return this.instances.get(token)?.get(name)
  }

  /** 校验阶段约束（只检查本地创建的 Model） */
  validatePhases(): void {
    for (const entry of this.order) {
      for (const dep of entry.deps) {
        if (dep.borrowed) continue
        if (entry.phase === 'pre' && dep.phase === 'after') {
          throw new Error(
            `[actview] Model 阶段冲突：${entry.token.name || 'Anonymous'} ` +
              `(@Setup pre) 依赖 ${dep.token.name || 'Anonymous'} (@Setup after)`,
          )
        }
      }
    }
  }

  runPhase(phase: 'pre' | 'after'): Promise<void> | null {
    const list = this.order.filter((entry) => entry.phase === phase)
    let chain: Promise<void> | null = null

    for (const entry of list) {
      if (chain) {
        chain = chain.then(() => this.executeEntry(entry))
      } else {
        const result = this.executeEntry(entry)
        if (result) chain = result
      }
    }
    return chain
  }

  applyLifecycleOrder(): void {
    for (const phase of MODEL_FIRST_PHASES) {
      const hooks = this.dataHooks[phase]
      if (!hooks || hooks.length === 0) continue
      const target = (this.owner as unknown as Record<string, Array<() => void>>)[
        phase
      ]
      target.unshift(...hooks)
    }
    for (const phase of OWNER_FIRST_PHASES) {
      const hooks = this.dataHooks[phase]
      if (!hooks || hooks.length === 0) continue
      const target = (this.owner as unknown as Record<string, Array<() => void>>)[
        phase
      ]
      target.push(...hooks)
    }
  }

  private createLocal(
    token: ModelToken,
    name: string,
    meta: ComponentMeta,
  ): object {
    const cyclic = this.resolving.find(
      (entry) => entry.token === token && entry.name === name,
    )
    if (cyclic) {
      const chain = [...this.resolving.map((e) => `${e.token.name}:${e.name}`), `${token.name}:${name}`]
        .join(' -> ')
      throw new Error(`[actview] Model 循环依赖：${chain}`)
    }

    const Ctor = token as unknown as new () => Record<string, any>
    const data = new Ctor()
    const entry: ModelEntry = {
      token,
      name,
      data,
      meta,
      phase: resolvePhase(meta),
      deps: new Set(),
      setupDone: false,
      runtimeDone: false,
      borrowed: false,
    }

    this.resolving.push(entry)
    try {
      installUseModels(this, data, meta)
      this.installModelProps(entry)
      installDeclaredFields(data, this.owner, meta, { bindProps: false })
      installComputed(data, meta, this.owner)
      this.collectModelHooks(data, meta)

      this.setEntry(entry)
      this.order.push(entry)
      return data
    } finally {
      this.resolving.pop()
    }
  }

  private borrow(
    token: ModelToken,
    name: string,
    data: Record<string, any>,
    meta: ComponentMeta,
  ): ModelEntry {
    const entry: ModelEntry = {
      token,
      name,
      data,
      meta,
      phase: resolvePhase(meta),
      deps: new Set(),
      setupDone: true,
      runtimeDone: true,
      borrowed: true,
    }
    this.setEntry(entry)
    return entry
  }

  private findInherited(
    token: ModelToken,
    name: string,
  ): { data: Record<string, any> } | undefined {
    let parent = this.owner.parent
    while (parent) {
      const data = parent.modelScope?.findInstance(token, name)
      if (data) return { data: data as Record<string, any> }
      parent = parent.parent
    }
    return undefined
  }

  private linkParent(entry: ModelEntry): void {
    const parent = this.resolving[this.resolving.length - 1]
    parent?.deps.add(entry)
  }

  private getEntry(
    token: ModelToken,
    name: string,
  ): ModelEntry | undefined {
    return this.entries.get(token)?.get(name)
  }

  private setEntry(entry: ModelEntry): void {
    let byName = this.entries.get(entry.token)
    if (!byName) {
      byName = new Map()
      this.entries.set(entry.token, byName)
    }
    byName.set(entry.name, entry)

    let instances = this.instances.get(entry.token)
    if (!instances) {
      instances = new Map()
      this.instances.set(entry.token, instances)
    }
    instances.set(entry.name, entry.data)
    this.linkParent(entry)
  }

  /** app scope 解析（实现见 componentScope 底部） */
  private resolveAppModel(
    token: ModelToken,
    name: string,
    meta: ComponentMeta,
  ): object {
    return resolveAppModel(this.owner.appContext, token, name, meta)
  }

  private installModelProps(entry: ModelEntry): void {
    if (entry.meta.props.size === 0) return
    const ownerMeta = getComponentMeta(this.owner.type as unknown as Function)
    const ownerCtx = this.owner.ctx as Record<string, any> | undefined
    for (const key of entry.meta.props.keys()) {
      if (!ownerMeta.props.has(key)) {
        throw new Error(
          `[actview] Model "${entry.token.name || 'Anonymous'}" 的 @Prop "${key}" ` +
            `未在组件 "${ownerMeta.name || 'Anonymous'}" 声明；` +
            '请在 owner 组件上声明同名 @Prop',
        )
      }
      const own = Object.getOwnPropertyDescriptor(entry.data, key)
      if (own) delete entry.data[key]
      Object.defineProperty(entry.data, key, {
        configurable: true,
        enumerable: true,
        get: () => ownerCtx?.[key],
        set: () => {
          throw new Error(
            `[actview] Model prop "${key}" 是只读的（由 owner 组件 @Prop 传入）`,
          )
        },
      })
    }
  }

  private executeEntry(entry: ModelEntry): void | Promise<void> {
    if (entry.runtimeDone || entry.setupDone) return
    entry.setupDone = true

    return this.withOwner(() => {
      const setupName = entry.meta.setup
      const result = setupName ? entry.data[setupName]?.() : undefined
      if (isThenable(result)) {
        return Promise.resolve(result).then(() =>
          this.withOwner(() => this.installRuntime(entry)),
        )
      }
      this.installRuntime(entry)
    })
  }

  private installRuntime(entry: ModelEntry): void {
    if (entry.runtimeDone) return
    installProvides(entry.data, entry.meta)
    installWatches(entry.data, entry.meta)
    entry.runtimeDone = true
  }

  private withOwner<T>(fn: () => T): T {
    const prev = setCurrentInstance(this.owner)
    pauseTracking()
    try {
      return this.owner.scope.run(fn) as T
    } finally {
      resetTracking()
      setCurrentInstance(prev)
    }
  }

  private collectModelHooks(
    data: Record<string, any>,
    meta: ComponentMeta,
  ): void {
    for (const [phase, methods] of Object.entries(meta.hooks) as Array<
      [LifecycleName, string[]]
    >) {
      if (!methods || methods.length === 0) continue
      const list = (this.dataHooks[phase] ??= [])
      for (const method of methods) {
        list.push(() => {
          data[method]?.()
        })
      }
    }
  }
}

/** 安装组件 / Model 上的 @UseModel 字段（scope 内单实例） */
export function installUseModels(
  scope: ComponentScope,
  target: Record<string, any>,
  meta: ComponentMeta,
): void {
  for (const [key, ref] of meta.models) {
    const model = scope.resolve(ref.token, ref.name)
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: model,
    })
  }
}

function resolvePhase(meta: ComponentMeta): 'pre' | 'after' {
  return meta.setupMode ?? 'pre'
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value != null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

// ============================================================
// app scope
// ============================================================

interface AppModelEntry {
  token: ModelToken
  name: string
  data: Record<string, any>
  meta: ComponentMeta
}

interface AppModelStore {
  scope: EffectScope
  owner: ComponentInternalInstance
  entries: Map<ModelToken, Map<string, AppModelEntry>>
}

interface AppModelContext extends AppContext {
  __modelStore?: AppModelStore
  __modelHooks?: {
    mounted: Array<() => void>
    beforeUnmount: Array<() => void>
    unmounted: Array<() => void>
  }
  __mounted?: boolean
}

function resolveAppModel(
  appContext: AppContext,
  token: ModelToken,
  name: string,
  meta: ComponentMeta,
): object {
  if (meta.props.size > 0) {
    throw new Error(
      `[actview] @Scope('app') Model "${token.name}" 暂不支持 @Prop（没有组件 owner）`,
    )
  }
  if (meta.provides.length > 0) {
    throw new Error(
      `[actview] @Scope('app') Model "${token.name}" 暂不支持 @Provide（app 级注入请用 app.provide）`,
    )
  }
  const unsupportedHooks = [
    'beforeMount',
    'beforeUpdate',
    'updated',
    'activated',
    'deactivated',
  ].filter((phase) => meta.hooks[phase as LifecycleName]?.length)
  if (unsupportedHooks.length > 0) {
    throw new Error(
      `[actview] @Scope('app') Model "${token.name}" 暂不支持生命周期：` +
        unsupportedHooks.join(', ') +
        '（仅支持 @Setup / @Mounted / @BeforeUnmount / @Unmounted）',
    )
  }

  const context = appContext as AppModelContext
  let store = context.__modelStore
  if (!store) {
    const scope = new EffectScope(true)
    const owner = createAppModelOwner(appContext, scope)
    store = { scope, owner, entries: new Map() }
    context.__modelStore = store
    context.__modelHooks ??= { mounted: [], beforeUnmount: [], unmounted: [] }
  }

  const existing = store.entries.get(token)?.get(name)
  if (existing) return existing.data

  const Ctor = token as unknown as new () => Record<string, any>
  const data = new Ctor()
  const entry: AppModelEntry = { token, name, data, meta }
  let byName = store.entries.get(token)
  if (!byName) {
    byName = new Map()
    store.entries.set(token, byName)
  }
  byName.set(name, entry)

  store.scope.run(() => {
    const prev = setCurrentInstance(store.owner)
    pauseTracking()
    try {
      installUseModelsForApp(appContext, data, meta)
      installDeclaredFields(data, store.owner, meta, { bindProps: false })
      installComputed(data, meta, store.owner)
      const setupName = meta.setup
      const result = setupName ? data[setupName]?.() : undefined
      if (isThenable(result)) {
        throw new Error(
          `[actview] @Scope('app') Model "${token.name}" 暂不支持 async @Setup`,
        )
      }
      // app scope 只处理 app 级生命周期
      for (const method of meta.hooks.mounted ?? []) {
        context.__modelHooks!.mounted.push(() => data[method]?.())
      }
      for (const method of meta.hooks.beforeUnmount ?? []) {
        context.__modelHooks!.beforeUnmount.push(() => data[method]?.())
      }
      for (const method of meta.hooks.unmounted ?? []) {
        context.__modelHooks!.unmounted.push(() => data[method]?.())
      }
      installProvides(data, meta)
      installWatches(data, meta)
    } finally {
      resetTracking()
      setCurrentInstance(prev)
    }
  })

  if (context.__mounted) {
    for (const fn of context.__modelHooks?.mounted.splice(0) ?? []) fn()
  }

  return data
}

function installUseModelsForApp(
  appContext: AppContext,
  target: Record<string, any>,
  meta: ComponentMeta,
): void {
  for (const [key, ref] of meta.models) {
    const model = resolveAppModel(
      appContext,
      ref.token,
      ref.name ?? getComponentMeta(ref.token).modelName ?? '',
      getComponentMeta(ref.token),
    )
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: model,
    })
  }
}

function createAppModelOwner(
  appContext: AppContext,
  scope: EffectScope,
): ComponentInternalInstance {
  const owner = {
    uid: 0,
    type: class AppModelOwner {},
    parent: null,
    appContext,
    vnode: null,
    props: {},
    render: () => null,
    subTree: null,
    effect: null,
    job: { run: () => {} },
    scope,
    renderCount: 0,
    isMounted: false,
    container: null,
    injects: appContext.provides,
    proxy: null,
    update: () => {},
    beforeMount: [],
    mounted: [],
    beforeUpdate: [],
    updated: [],
    beforeUnmount: [],
    unmounted: [],
    activated: [],
    deactivated: [],
    errorCaptured: [],
  } as unknown as ComponentInternalInstance
  return owner
}

/** 供 app.ts 在 mount/unmount 时调用 app-scope Model 钩子 */
export function invokeAppModelHooks(
  appContext: AppContext,
  phase: 'mount' | 'beforeUnmount' | 'unmount',
): void {
  const context = appContext as AppModelContext
  context.__mounted = phase === 'mount' ? true : context.__mounted
  const hooks = context.__modelHooks
  if (!hooks) return
  if (phase === 'mount') {
    for (const fn of hooks.mounted.splice(0)) fn()
  } else if (phase === 'beforeUnmount') {
    for (const fn of hooks.beforeUnmount.splice(0)) fn()
  } else {
    for (const fn of hooks.unmounted.splice(0)) fn()
    context.__modelStore?.scope.stop()
    context.__modelStore = undefined
  }
}
