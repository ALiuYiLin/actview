// ============================================================
// @actview/core — 生命周期类装饰器
// ============================================================

import { metaOf, type LifecycleName } from './meta'

/**
 * @Setup 方法装饰器：
 * - 组件：实例创建后、首帧前执行一次；可返回 Promise；
 * - Model：默认在 owner 组件 @Setup 之前；`@Setup('after')` 在组件 setup 之后；
 *   带 @Prop 的 Model 未显式指定时默认 after（等待组件赋值）。
 */
export function Setup(
  target: object,
  key: string,
  descriptor?: PropertyDescriptor,
): void
export function Setup(mode: 'pre' | 'after'): MethodDecorator
export function Setup(
  targetOrMode?: object | 'pre' | 'after',
  key?: string,
  _descriptor?: PropertyDescriptor,
): void | MethodDecorator {
  if (typeof targetOrMode === 'string') {
    const mode = targetOrMode
    return (target: object, propertyKey: string | symbol): void => {
      const meta = metaOf(target)
      meta.setup = String(propertyKey)
      meta.setupMode = mode
    }
  }
  if (targetOrMode && key !== undefined) {
    metaOf(targetOrMode).setup = key
  }
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
