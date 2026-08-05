import { defineComponent } from './component'
import { getCurrentInstance, onBeforeUnmount } from './lifecycle'
import { ref } from '../reactivity/ref'

// ============================================================
// ErrorBoundary — 捕获子树渲染错误并显示 fallback
//   <ErrorBoundary fallback={<b>出错了</b>}><Comp /></ErrorBoundary>
//
// 机制：
//   1. 模块级栈：ErrorBoundary 挂载时入栈、卸载时出栈
//   2. mountComponent 的 update 包 try/catch：子组件渲染抛错 →
//      交给栈顶 ErrorBoundary（errorRef 置错 → 响应式重渲染显示 fallback）
//   3. 已有错误的边界不重复触发（防止 fallback 抛错死循环）
//   4. 无边界时 console.error
// ============================================================

const boundaryStack: any[] = []

export function pushErrorBoundary(instance: any) {
  boundaryStack.push(instance)
}

export function popErrorBoundary(instance: any) {
  const i = boundaryStack.indexOf(instance)
  if (i >= 0) boundaryStack.splice(i, 1)
}

/** 返回最近的错误边界实例（栈顶），没有则 null */
export function getErrorBoundary(): any {
  return boundaryStack.length ? boundaryStack[boundaryStack.length - 1] : null
}

export const ErrorBoundary = defineComponent(function (props: any) {
  const self = getCurrentInstance()!
  const error = ref<any>(null)
  ;(self as any).errorRef = error

  pushErrorBoundary(self)
  onBeforeUnmount(() => popErrorBoundary(self))

  return () => {
    if (error.value != null) {
      // fallback 可以是 VNode 或函数（接收错误对象）
      return typeof props.fallback === 'function'
        ? props.fallback(error.value)
        : (props.fallback ?? null)
    }
    return props.children
  }
})
