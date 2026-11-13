// ============================================================
// @actview/core — installLifecycle
//
// 把装饰器记录的生命周期方法注册到实例 hooks 数组（父类 → 子类）。
// ============================================================

import type { ComponentMeta } from '../decorator/meta'
import type { ComponentInternalInstance } from './instance'

/** 把装饰器记录的生命周期方法注册到实例 hooks 数组（顺序：父类 → 子类） */
export function registerClassLifecycle(
  instance: ComponentInternalInstance,
  ctx: Record<string, any>,
  meta: ComponentMeta,
): void {
  for (const name of Object.keys(meta.hooks) as Array<
    keyof typeof meta.hooks
  >) {
    const methods = meta.hooks[name]
    if (!methods) continue
    const hooks = (instance as unknown as Record<string, Array<() => void>>)[
      name as string
    ]
    if (!hooks) continue
    for (const method of methods) {
      hooks.push(() => {
        ctx[method]?.()
      })
    }
  }
}
