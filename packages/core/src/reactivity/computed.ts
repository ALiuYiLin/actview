import { ReactiveEffect, track, trigger } from "../runtime/reactive-system"

// ============================================================
// computed — 基于 effect + 脏标记的惰性计算值
//   - 惰性：读取 value 才求值（脏标记 _dirty 控制）
//   - 缓存：依赖不变时多次读取直接返回上次结果
//   - 链式响应：依赖变化 =》 置脏 + trigger 外层读取者（computed 本身
//     也是依赖源，读取它的 effect 会被收集进 value 的依赖）
// ============================================================

export class ComputedRefImpl<T> {
  readonly __v_isRef = true
  private _value!: T
  private _dirty = true
  readonly effect: ReactiveEffect
  private getter: () => T

  constructor(getter: () => T) {
    this.getter = getter
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
      },
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
}

export function computed<T>(getter: () => T): { readonly value: T } {
  return new ComputedRefImpl(getter)
}
