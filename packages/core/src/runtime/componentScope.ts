// ============================================================
// @actview/core — ComponentScope
//
// 每个组件实例一个 scope：@UseModel(Token) 在同一 scope 内解析为单实例；
// 默认 per-component，不做 app 级 singleton。
// ============================================================

import { getComponentMeta } from '../decorator'
import type {
  ComponentMeta,
  LifecycleName,
  ModelToken,
} from '../decorator'
import { isModel } from '../types/component'
import type { ComponentInternalInstance } from './instance'
import {
  installComputed,
  installDeclaredFields,
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

export class ComponentScope {
  readonly owner: ComponentInternalInstance

  private readonly instances = new Map<ModelToken, object>()
  private readonly resolving: ModelToken[] = []
  private readonly dataHooks: Partial<Record<LifecycleName, Array<() => void>>> =
    {}

  constructor(owner: ComponentInternalInstance) {
    this.owner = owner
  }

  /**
   * 解析 Model 单实例：
   * - 同一 token 缓存；
   * - 递归解析其 @UseModel 字段；
   * - 安装 @Ref/@Reactive/@Computed/@Inject + 生命周期；
   * - 执行同步 @Setup；@Watch 在 setup 后安装。
   */
  resolve<T extends object>(token: ModelToken): T {
    if (!isModel(token)) {
      throw new Error(
        `[actview] @UseModel token 不是 @Model 类：${String(token)}`,
      )
    }

    const cached = this.instances.get(token)
    if (cached) return cached as T

    if (this.resolving.includes(token)) {
      const chain = [...this.resolving, token]
        .map((ctor) => ctor.name || 'Anonymous')
        .join(' -> ')
      throw new Error(`[actview] Model 循环依赖：${chain}`)
    }

    this.resolving.push(token)
    try {
      const Ctor = token as unknown as new () => Record<string, any>
      const data = new Ctor()

      const meta = getComponentMeta(token)
      installUseModels(this, data, meta)
      installDeclaredFields(data, this.owner, meta)
      installComputed(data, meta)
      this.collectModelHooks(data, meta)

      const setupName = meta.setup
      const result = setupName ? data[setupName]?.() : undefined
      if (isThenable(result)) {
        throw new Error(
          `[actview] Model "${token.name || 'Anonymous'}" 的 @Setup 暂不支持 async（第一版要求同步）`,
        )
      }

      installWatches(data, meta)
      // 依赖全部安装完成后才入缓存：循环路径会先命中 resolving 并报错。
      this.instances.set(token, data)
      return data as T
    } finally {
      this.resolving.pop()
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

/** 识别 Model @Setup 返回 Promise（第一版明确不支持 async Model setup） */
function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value != null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}
