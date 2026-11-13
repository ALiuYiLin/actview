// ============================================================
// @actview/core — 生命周期类装饰器
// ============================================================

import { metaOf, type LifecycleName } from './meta'

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
