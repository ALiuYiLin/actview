// ============================================================
// @actview/core — ComponentScope
//
// 每个组件实例一个 scope：@UseModel(Token) 在同一 scope 内解析为单实例；
// @Setup('pre'|'after') 相对 owner 组件 @Setup：
//   pre  → 组件 setup 前（默认）
//   after→ 组件 setup 后
// Model @Prop 是 owner 组件同名 @Prop 的只读投影。
// ============================================================

import { pauseTracking, resetTracking } from '@actview/reactivity'
import { getComponentMeta } from '../decorator'
import type {
  ComponentMeta,
  LifecycleName,
  ModelToken,
} from '../decorator'
import { setCurrentInstance } from '../lifecycle'
import { isModel } from '../types/component'
import type { ComponentInternalInstance } from './instance'
import {
  installComputed,
  installDeclaredFields,
  installProvides,
  installWatches,
} from './installReactiveApi'

/** 先于 owner 执行的阶段（初始化 / 挂载 / 更新 / 激活） */
const MODEL_FIRST_PHASES: LifecycleName[] = [
  'beforeMount',
  'mounted',
  'beforeUpdate',
  'updated',
  'activated',
]

/** 后于 owner 执行的阶段（失活 / 卸载） */
const OWNER_FIRST_PHASES: LifecycleName[] = [
  'deactivated',
  'beforeUnmount',
  'unmounted',
]

interface ModelEntry {
  token: ModelToken
  data: Record<string, any>
  meta: ComponentMeta
  phase: 'pre' | 'after'
  deps: Set<ModelToken>
  setupDone: boolean
  runtimeDone: boolean
}

export class ComponentScope {
  readonly owner: ComponentInternalInstance

  private readonly instances = new Map<ModelToken, object>()
  private readonly entries = new Map<ModelToken, ModelEntry>()
  private readonly resolving: ModelEntry[] = []
  /** 依赖完成顺序：dependencies 先于 dependents */
  private readonly order: ModelEntry[] = []
  private readonly dataHooks: Partial<Record<LifecycleName, Array<() => void>>> =
    {}

  constructor(owner: ComponentInternalInstance) {
    this.owner = owner
  }

  /**
   * 解析 Model：构造 + 递归依赖 + 安装字段/computed + 收集生命周期。
   * @Setup 不在这里执行，由 runPhase('pre'|'after') 按组件基准执行。
   */
  resolve<T extends object>(token: ModelToken): T {
    if (!isModel(token)) {
      throw new Error(
        `[actview] @UseModel token 不是 @Model 类：${String(token)}`,
      )
    }

    const cached = this.instances.get(token)
    if (cached) return cached as T

    const cyclic = this.resolving.find((entry) => entry.token === token)
    if (cyclic) {
      const chain = [...this.resolving.map((e) => e.token), token]
        .map((ctor) => ctor.name || 'Anonymous')
        .join(' -> ')
      throw new Error(`[actview] Model 循环依赖：${chain}`)
    }

    const Ctor = token as unknown as new () => Record<string, any>
    const data = new Ctor()
    const meta = getComponentMeta(token)
    const entry: ModelEntry = {
      token,
      data,
      meta,
      phase: resolvePhase(meta),
      deps: new Set(),
      setupDone: false,
      runtimeDone: false,
    }

    const parent = this.resolving[this.resolving.length - 1]
    parent?.deps.add(token)

    this.resolving.push(entry)
    try {
      installUseModels(this, data, meta)
      // Model @Prop 是 owner 组件 prop 的只读投影。
      this.installModelProps(entry)
      // @Prop 由上面的投影处理；这里只安装 ref/reactive/inject。
      installDeclaredFields(data, this.owner, meta, { bindProps: false })
      installComputed(data, meta)
      this.collectModelHooks(data, meta)

      this.entries.set(token, entry)
      this.order.push(entry)
      this.instances.set(token, data)
      return data as T
    } finally {
      this.resolving.pop()
    }
  }

  /** 校验阶段约束：pre Model 不能依赖 after Model（否则 setup 顺序不可能同时成立） */
  validatePhases(): void {
    for (const entry of this.order) {
      for (const depToken of entry.deps) {
        const dep = this.entries.get(depToken)
        if (!dep) continue
        if (entry.phase === 'pre' && dep.phase === 'after') {
          throw new Error(
            `[actview] Model 阶段冲突：${entry.token.name || 'Anonymous'} ` +
              `(@Setup pre) 依赖 ${dep.token.name || 'Anonymous'} (@Setup after)`,
          )
        }
      }
    }
  }

  /**
   * 执行某阶段所有 Model 的 @Setup 并安装 @Provide/@Watch。
   * 返回 Promise 表示该阶段包含异步 setup；否则同步完成返回 null。
   */
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

  /**
   * 在 owner 组件生命周期 hooks 注册完成后调用：
   * - 初始化 / 挂载类阶段：Model hooks 在 owner 之前；
   * - 失活 / 卸载类阶段：owner hooks 在 Model 之前（逆序）。
   */
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

  /** Model @Prop：只读投影 owner 组件的同名 @Prop；组件必须声明。 */
  private installModelProps(entry: ModelEntry): void {
    if (entry.meta.props.size === 0) return
    const ownerMeta = getComponentMeta(
      this.owner.type as unknown as Function,
    )
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
    if (entry.runtimeDone) return
    if (entry.setupDone) return
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
    // Model @Provide：在当前 owner 注入表上 copy-on-write，后代可 inject。
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

  /** 收集 Model 的生命周期方法，等 owner 组件 hooks 注册后按顺序合并 */
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
  for (const [key, token] of meta.models) {
    const model = scope.resolve(token)
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
