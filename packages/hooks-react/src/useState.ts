// ============================================================
// useState / useReducer — React 状态 hook 的 ActView 实现
//
// 核心差异（重要）：
//   React：组件函数每次渲染重新执行，useState 返回"当前值"快照
//   ActView：组件函数体 = setup，只执行一次；返回 **ref 活引用**
//
//   const [count, setCount] = useState(0)
//   <div>{count}</div>            // JSX 自动解包 ref ✓ 零改动
//   if (count.value > 5) {...}    // setup/逻辑处需 .value（React 的 count 是值）
//
// setState 支持 React 两种形态：值 或 函数式更新 setCount(c => c + 1)
// useState 支持 React lazy 初始化：useState(() => expensive())
// ============================================================

import { ref, type Ref } from '@actview/core'

/** React setState 入参：新值 或 (prev) => 新值 */
export type SetStateAction<T> = T | ((prev: T) => T)

export function useState<T>(initialState: T | (() => T)): [
  Ref<T>,
  (action: SetStateAction<T>) => void
] {
  const stateRef = ref<T>(
    typeof initialState === 'function' ? (initialState as () => T)() : initialState
  )
  const setState = (action: SetStateAction<T>) => {
    stateRef.value =
      typeof action === 'function' ? (action as (prev: T) => T)(stateRef.value) : action
  }
  return [stateRef, setState]
}

/** useReducer：ref 存状态，dispatch 用 reducer 计算下一状态。支持 init 惰性初始化。 */
export function useReducer<S, A>(
  reducer: (state: S, action: A) => S,
  initialArg: S,
  init?: (arg: S) => S
): [Ref<S>, (action: A) => void] {
  const stateRef = ref<S>(init ? init(initialArg) : initialArg)
  const dispatch = (action: A) => {
    stateRef.value = reducer(stateRef.value, action)
  }
  return [stateRef, dispatch]
}
