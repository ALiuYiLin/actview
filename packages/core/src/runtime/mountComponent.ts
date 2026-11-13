// ============================================================
// @actview/core — mountClassComponent
//
// 类组件挂载编排：
//   new Ctor → Model 安装（pre setup）→ 组件字段/生命周期 →
//   组件 @Setup → Model after setup → @Provide/@Watch → render
//
// Model 的 @Setup 基准是 owner 组件 @Setup：
//   - pre（默认）：组件 setup 前；
//   - after：组件 setup 后（带 @Prop 的 Model 默认 after）。
// 任一阶段返回 Promise 时先渲染 null，resolve 后再切真实 render。
// ============================================================

import { pauseTracking, resetTracking } from '@actview/reactivity'
import type { ComponentMeta } from '../decorator/meta'
import { getComponentMeta } from '../decorator'
import { setCurrentInstance } from '../lifecycle'
import type { ClassComponentCtor } from '../types/component'
import type { RenderFunction } from '../types/component'
import type {
  ComponentInternalInstance,
  ComponentPublicInstance,
} from './instance'
import {
  installComputed,
  installDeclaredFields,
  installProvides,
  installWatches,
} from './installReactiveApi'
import { registerClassLifecycle } from './installLifecycle'
import { nextTick } from './scheduler'
import { ComponentScope, installUseModels } from './componentScope'

/**
 * 类组件挂载。
 *
 * @Ref / @Prop 的 accessor 必须在构造之后安装：ES2022 class field 的 define
 * 语义会创建 own data property 并遮蔽原型 accessor。
 */
export function mountClassComponent(
  instance: ComponentInternalInstance,
): Promise<RenderFunction> | null {
  const Ctor = instance.type as unknown as ClassComponentCtor
  const meta: ComponentMeta = getComponentMeta(Ctor)
  const ctx = new Ctor(instance.props) as Record<string, any>

  instance.ctx = ctx
  instance.proxy = ctx as unknown as ComponentPublicInstance
  installClassPublicInstance(ctx, instance)

  const modelScope = new ComponentScope(instance)
  instance.modelScope = modelScope

  const withOwner = <T>(fn: () => T): T => {
    const prev = setCurrentInstance(instance)
    pauseTracking()
    try {
      return instance.scope.run(fn) as T
    } finally {
      resetTracking()
      setCurrentInstance(prev)
    }
  }

  const finalize = (): RenderFunction =>
    withOwner(() => {
      installProvides(ctx, meta)
      installWatches(ctx, meta)
      instance.render = () => ctx.render()
      return instance.render
    })

  const finishAfterSetups = (): RenderFunction | Promise<RenderFunction> => {
    const afterPending = modelScope.runPhase('after')
    return afterPending ? afterPending.then(finalize) : finalize()
  }

  const runComponentSetup = (): RenderFunction | Promise<RenderFunction> =>
    withOwner(() => {
      const setupName = meta.setup
      const result = setupName ? ctx[setupName]?.() : undefined
      if (isThenable(result)) {
        return Promise.resolve(result).then(finishAfterSetups)
      }
      return finishAfterSetups()
    })

  const start = (): RenderFunction | Promise<RenderFunction> =>
    withOwner(() => {
      // 1) 组件自身字段先就位：Model @Prop 需要读取 owner 的 @Prop accessor。
      installDeclaredFields(ctx, instance, meta)
      installComputed(ctx, meta, instance)

      // 2) 构造 Model + 安装字段/computed；@Setup 延迟到阶段执行。
      installUseModels(modelScope, ctx, meta)
      modelScope.validatePhases()

      // 3) 组件生命周期注册；Model hooks 按挂载/卸载方向排序。
      registerClassLifecycle(instance, ctx, meta)
      modelScope.applyLifecycleOrder()

      // 4) Model pre setup → 组件 setup → Model after setup。
      const prePending = modelScope.runPhase('pre')
      return prePending ? prePending.then(runComponentSetup) : runComponentSetup()
    })

  const result = start()
  if (isThenable(result)) {
    instance.render = (() => null) as unknown as RenderFunction
    return Promise.resolve(result).then((render) => {
      instance.render = render
      return render
    })
  }

  instance.render = result
  return null
}

/** 类实例公开字段：$ / $props / $el / $parent / $root / $forceUpdate / $nextTick */
function installClassPublicInstance(
  ctx: Record<string, any>,
  instance: ComponentInternalInstance,
): void {
  const defineValue = (key: string, value: unknown): void => {
    Object.defineProperty(ctx, key, {
      configurable: true,
      enumerable: false,
      value,
    })
  }
  const defineGetter = (key: string, get: () => unknown): void => {
    Object.defineProperty(ctx, key, {
      configurable: true,
      enumerable: false,
      get,
    })
  }

  defineValue('$', instance)
  defineGetter('$props', () => instance.props)
  defineGetter('$el', () => (instance.vnode.el as Element | null) ?? null)
  defineGetter('$parent', () => instance.parent?.proxy ?? null)
  defineGetter('$root', () => {
    let root = instance
    while (root.parent) root = root.parent
    return root.proxy
  })
  defineValue('$forceUpdate', () => instance.update())
  defineValue('$nextTick', nextTick)
  defineValue('$refs', {})
}

/** isThenable：识别 @Setup 返回 Promise 的情况（async setup） */
function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value != null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

