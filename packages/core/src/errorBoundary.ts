// ============================================================
// ErrorBoundary — 捕获子树错误并渲染 fallback（M3）
//
//   h(ErrorBoundary, { fallback: h('b', '出错了') }, children)
//   // fallback 也可以是函数：(err) => VNode
//
// 机制：
//   - setup 注册 onErrorCaptured（沿 parent 链由 handleError 调用）；
//     第一个错误写入 error ref，返回 false = 已捕获，阻止继续向上传播；
//   - error 是响应式的：写入触发本组件 render effect 重渲染 → 渲染 fallback；
//   - 已有错误时不再改写（fallback 自身抛错不会形成循环——重复错误仍被
//     捕获但不会再次触发 error ref 写入）。
// ============================================================

import { ref } from '@actview/reactivity'
import { defineComponent } from '@actview/runtime-core'
import { getCurrentInstance, onErrorCaptured } from './lifecycle'

export const ErrorBoundary = defineComponent<Record<string, any>>(
  (props) => {
    const self = getCurrentInstance()!
    const error = ref<unknown>(null)

    onErrorCaptured((err) => {
      // 只记录第一个错误；返回 false = 已捕获，停止沿 parent 链向上
      if (error.value == null) {
        error.value = err
        // 错误通常发生在子树挂载 / 渲染期间，此时本组件的 render effect 可能
        // 仍处于 RUNNING（自触发保护会吞掉刚才的响应式写入）——显式入队一次
        // 更新，确保 fallback 渲染出来。
        self.update()
      }
      return false
    })

    return () => {
      if (error.value != null) {
        const fallback = props.fallback
        return typeof fallback === 'function'
          ? fallback(error.value)
          : (fallback ?? null)
      }
      return props.children
    }
  },
  'ErrorBoundary',
)
