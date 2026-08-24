// ============================================================
// useRef / useImperativeHandle — 引用与实例句柄
//
// useRef 返回 **双形状** 对象，同时兼容两套语义：
//   .current — React 代码：inputRef.current.focus()
//   .value   — ActView 模板引用：<input ref={myRef}> 由 applyRef 写 .value
// 两者 getter/setter 都转发内部 ref，在响应式上下文读取会建立依赖追踪。
//
// useImperativeHandle(ref, createHandle, deps?)：
//   ActView 组件 ref 默认指向组件实例；在 onMounted（applyRef 写入 instance
//   之后）覆盖为自定义句柄，卸载时 applyRef(ref, null) 自动置空（React 语义）。
//   deps 变化时重建句柄（watch 追踪，deps 里的响应式值变化即重建）。
// ============================================================

import { ref, watch, onMounted, toValue } from '@actview/core'

/** useRef 返回对象：React 的 .current 与 ActView 的 .value 并存 */
export interface ReactLikeRef<T> {
  value: T
  current: T
}

export function useRef<T>(initialValue: T | null): ReactLikeRef<T | null>
export function useRef<T>(initialValue: T): ReactLikeRef<T>
export function useRef(initialValue: any): ReactLikeRef<any> {
  const inner = ref(initialValue)
  return {
    get value() {
      return inner.value
    },
    set value(v: any) {
      inner.value = v
    },
    get current() {
      return inner.value
    },
    set current(v: any) {
      inner.value = v
    },
  }
}

export function useImperativeHandle(
  ref: ReactLikeRef<any> | ((instance: any) => void) | null | undefined,
  createHandle: () => object,
  deps?: unknown[]
): void {
  const apply = () => {
    if (!ref) return
    const handle = createHandle()
    if (typeof ref === 'function') ref(handle)
    else {
      ref.value = handle
      ref.current = handle
    }
  }
  // onMounted：此时 mountComponent 已把 instance 写入 ref，覆盖为自定义句柄
  onMounted(apply)
  if (deps !== undefined) {
    // deps 变化重建句柄（deps=[] 时 getter 恒返回 []，只执行 onMounted 一次）
    watch(() => deps.map((d) => toValue(d)), apply)
  }
}
