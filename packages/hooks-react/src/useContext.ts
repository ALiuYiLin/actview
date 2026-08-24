// ============================================================
// useContext — React 上下文消费
//
//   const ThemeCtx = createContext('dark')     // actview 原生 createContext
//   const theme = useContext(ThemeCtx)          // → Ref<T>（context.use()）
//   <div class={theme.value}>...</div>          // render 里读 .value 建立追踪
//
// 返回值是 ref 活引用：Provider value 变化 → 消费方自动重渲染（对齐 React）。
// JSX 里可直接用（自动解包）：<div>{theme}</div>。
// ============================================================

import { type Context, type Ref } from '@actview/core'

export function useContext<T>(context: Context<T>): Ref<T> {
  return context.use()
}
