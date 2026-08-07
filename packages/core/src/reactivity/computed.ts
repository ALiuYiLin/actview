import { ReactiveEffect, track, trigger } from '../runtime/reactive-system'
import type { Ref } from './ref'

/** computed 的公开类型：带 __v_isRef 标记的只读 Ref（与运行时实现一致） */
export interface ComputedRef<T = any> extends Ref<T> {
  readonly value: T
}

/** 可写 computed（`computed({ get, set })`）返回类型：value 可写 */
export interface WritableComputedRef<T = any> extends Ref<T> {
  value: T
}

/** computed 选项形态：{ get, set } */
export interface ComputedOptions<T = any> {
  get: () => T
  set?: (value: T) => void
}

// ============================================================
// computed — 基于 effect + 脏标记的惰性计算值
//   - 惰性：读取 value 才求值（脏标记 _dirty 控制）
//   - 缓存：依赖不变时多次读取直接返回上次结果
//   - 链式响应：依赖变化 =》 置脏 + trigger 外层读取者（computed 本身
//     也是依赖源，读取它的 effect 会被收集进 value 的依赖）
//   - 可写：`computed({ get, set })` 时 setter 赋值触发；只读 computed
//     赋值 console.warn（对齐 Vue 3）
// ============================================================

export class ComputedRefImpl<T> {
  readonly __v_isRef = true
  private _value!: T
  private _dirty = true
  readonly effect: ReactiveEffect
  private readonly getter: () => T
  private readonly setter?: (value: T) => void

  constructor(getter: () => T, setter?: (value: T) => void) {
    this.getter = getter
    this.setter = setter
    this.effect = new ReactiveEffect(
      () => {
        // 求值时 activeEffect = 本 computed 的 effect：
        // getter 里读到的响应式源会收集到本 effect
        this._value = this.getter()
      },
      () => {
        // 依赖变化：置脏并通知所有读取过本 computed 的 effect（如组件渲染）
        if (!this._dirty) {
          this._dirty = true
          trigger(this, 'value')
        }
      }
    )
  }

  get value(): T {
    if (this._dirty) {
      this._dirty = false
      this.effect.run()
    }
    // 外层 effect 读取时收集依赖（computed 作为依赖源）
    track(this, 'value')
    return this._value
  }

  set value(newValue: T) {
    if (this.setter) {
      this.setter(newValue)
    } else {
      console.warn('[actview] computed 是只读的（缺少 setter），赋值被忽略')
    }
  }
}

/** 只读 computed：getter 函数形态 */
export function computed<T>(getter: () => T): ComputedRef<T>
/** 可写 computed：{ get, set } 选项形态（set 缺省时退化为只读 + warn） */
export function computed<T>(options: ComputedOptions<T>): WritableComputedRef<T>
export function computed<T>(
  getterOrOptions: (() => T) | ComputedOptions<T>
): ComputedRef<T> | WritableComputedRef<T> {
  if (typeof getterOrOptions === 'function') {
    return new ComputedRefImpl<T>(getterOrOptions)
  }
  const { get, set } = getterOrOptions
  return new ComputedRefImpl<T>(get, set)
}
