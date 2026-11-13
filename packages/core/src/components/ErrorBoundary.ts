// ============================================================
// ErrorBoundary — 捕获子树错误并渲染 fallback（M3，第一版类组件迁移）
//
//   h(ErrorBoundary, { fallback: h('b', '出错了') }, children)
//   // fallback 也可以是函数：(err) => VNode
//
// 机制：
//   - @Setup 注册 onErrorCaptured（沿 parent 链由 handleError 调用）；
//     第一个错误写入 @Ref error，返回 false = 已捕获，阻止继续向上传播；
//   - error 是响应式的：写入触发本组件 render effect 重渲染 → 渲染 fallback；
//   - 已有错误时不再改写（fallback 自身抛错不会形成循环）。
// ============================================================

import { Component, Ref, Setup, ActViewComponent } from '../decorator'
import { getCurrentInstance, onErrorCaptured } from '../lifecycle'

@Component({ name: 'ErrorBoundary' })
export class ErrorBoundary extends ActViewComponent<Record<string, any>> {
  @Ref
  error: unknown = null

  @Setup
  setup(): void {
    const self = getCurrentInstance()
    onErrorCaptured((err) => {
      // 只记录第一个错误；返回 false = 已捕获，停止沿 parent 链向上
      if (this.error == null) {
        this.error = err
        // 错误通常发生在子树挂载 / 渲染期间，此时本组件的 render effect
        // 可能仍处于 RUNNING（自触发保护会吞掉刚才的响应式写入）——
        // 显式入队一次更新，确保 fallback 渲染出来。
        self?.update()
      }
      return false
    })
  }

  render() {
    const props = this.$props
    if (this.error != null) {
      const fallback = props.fallback
      return typeof fallback === 'function'
        ? fallback(this.error)
        : (fallback ?? null)
    }
    return props.children
  }
}
