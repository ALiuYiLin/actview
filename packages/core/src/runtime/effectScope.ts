import type { ReactiveEffect } from './reactive-system'

// ============================================================
// EffectScope — 作用域批量管理 effect 生命周期（参考 Vue 3）
//   - 组件实例持有 scope：setup 期间创建的 watch/computed/render effect
//     自动注册进组件 scope，组件卸载时 scope.stop() 一并停止
//   - 嵌套：scope 构造时记录 parent，on/off 恢复上一级
// ============================================================

let activeEffectScope: EffectScope | undefined

export class EffectScope {
  effects: ReactiveEffect[] = []
  parent: EffectScope | undefined
  private _isStopped = false

  constructor() {
    this.parent = activeEffectScope
  }

  /** 激活本 scope：后续创建的 effect 注册进来 */
  on() {
    activeEffectScope = this
  }

  /** 恢复上一级 scope */
  off() {
    activeEffectScope = this.parent
  }

  /** 在 scope 激活状态下执行 fn（自动 on/off） */
  run<T>(fn: () => T): T {
    this.on()
    try {
      return fn()
    } finally {
      this.off()
    }
  }

  /** 停止 scope 内全部 effect（幂等） */
  stop() {
    if (this._isStopped) return
    this._isStopped = true
    this.effects.forEach((e) => e.stop())
    this.effects.length = 0
  }
}

export function getCurrentScope(): EffectScope | undefined {
  return activeEffectScope
}
