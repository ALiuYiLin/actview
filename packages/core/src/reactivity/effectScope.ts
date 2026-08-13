import type { ReactiveEffect } from './reactive-system'

// ============================================================
// EffectScope — 作用域批量管理 effect 生命周期（参考 Vue 3）
//   - 组件实例持有 scope：setup 期间创建的 watch/computed/render effect
//     自动注册进组件 scope，组件卸载时 scope.stop() 一并停止
//   - 嵌套：scope 构造时记录 parent，on/off 恢复上一级
//   - 公开 API：effectScope() 创建并激活作用域；onScopeDispose()
//     注册清理函数（scope.stop() 时执行）
// ============================================================

let activeEffectScope: EffectScope | undefined

export class EffectScope {
  effects: ReactiveEffect[] = []
  cleanups: (() => void)[] = []
  parent: EffectScope | undefined
  scopes: EffectScope[] = []
  private _isStopped = false

  constructor(detached = false) {
    this.parent = activeEffectScope
    if (!detached && activeEffectScope) {
      activeEffectScope.scopes.push(this)
    }
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

  /** 停止 scope 内全部 effect + 执行清理函数（幂等） */
  stop() {
    if (this._isStopped) return
    this._isStopped = true
    this.effects.forEach((e) => e.stop())
    this.cleanups.forEach((fn) => fn())
    this.scopes.forEach((s) => s.stop())
    this.effects.length = 0
    this.cleanups.length = 0
    this.scopes.length = 0
  }
}

export function getCurrentScope(): EffectScope | undefined {
  return activeEffectScope
}

/**
 * 创建一个作用域。用 scope.run(fn) 在作用域激活状态下执行 fn；
 * 期间创建的 effect / onScopeDispose 注册进该 scope。
 * detached: true 时不被父 scope 追踪（父 stop 不影响它）。
 */
export function effectScope(detached?: boolean): EffectScope {
  return new EffectScope(detached)
}

/** 在当前作用域注册清理函数：作用域 stop() 时执行 */
export function onScopeDispose(fn: () => void) {
  if (activeEffectScope) {
    activeEffectScope.cleanups.push(fn)
  } else {
    console.warn('[actview] onScopeDispose 只能在 effectScope 内调用')
  }
}
