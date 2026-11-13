// ============================================================
// @actview/core — mountClassComponent
//
// 类组件挂载编排：new Ctor → 公开实例 → installReactiveApi →
// installLifecycle → @Setup → @Provide/@Watch → render。
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
/**
 * 类组件 setup：
 *
 *   new Ctor(props) → 公开实例 → scope 内安装 @Prop/@Ref/@Reactive/@Computed/
 *   @Inject → 注册生命周期 → @Setup → @Provide/@Watch → render
 *
 * @Ref / @Prop 的 accessor 必须在构造之后安装：ES2022 class field 的 define
 * 语义会创建 own data property 并遮蔽原型 accessor（见设计文档 §3.3）。
 */
export function mountClassComponent(
  instance: ComponentInternalInstance,
): Promise<RenderFunction> | null {
  const Ctor = instance.type as unknown as ClassComponentCtor
  const meta = getComponentMeta(Ctor)
  const ctx = new Ctor(instance.props) as Record<string, any>

  instance.ctx = ctx
  instance.proxy = ctx as unknown as ComponentPublicInstance
  installClassPublicInstance(ctx, instance)

  const prev = setCurrentInstance(instance)
  try {
    let pending: Promise<RenderFunction> | null = null

    instance.scope.run(() => {
      pauseTracking()
      try {
        // 字段 / 注入 / computed 必须在 setup 前就位。
        installDeclaredFields(ctx, instance, meta)
        installComputed(ctx, meta)
        registerClassLifecycle(instance, ctx, meta)

        const setupName = meta.setup
        const result = setupName ? ctx[setupName]?.() : undefined

        // 允许 @Setup 返回 Promise（async setup）：先渲染 null 占位，
        // resolve 后再安装 @Provide/@Watch 并切回真实 render。
        if (isThenable(result)) {
          instance.render = (() => null) as unknown as RenderFunction
          pending = Promise.resolve(result).then(() => {
            const prevInner = setCurrentInstance(instance)
            try {
              instance.scope.run(() => {
                pauseTracking()
                try {
                  installProvides(ctx, meta)
                  installWatches(ctx, meta)
                } finally {
                  resetTracking()
                }
              })
            } finally {
              setCurrentInstance(prevInner)
            }
            instance.render = () => ctx.render()
            return instance.render
          })
          return
        }

        installProvides(ctx, meta)
        installWatches(ctx, meta)
      } finally {
        resetTracking()
      }
    })

    if (!pending) {
      instance.render = () => ctx.render()
    }
    return pending
  } finally {
    setCurrentInstance(prev)
  }
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

