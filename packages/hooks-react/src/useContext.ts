// ============================================================
// useContext — React 上下文消费
//
//   const state = useContext(ThemeCtx)   // → 原样值（store-as-is 语义）
//   <div class={state.theme}>...</div>   // render 里读响应式数据建立追踪
//
// 契约：createContext 为 store-as-is——use() 返回注入表中【原样存储】的值。
// 响应式由使用方保证:Provider 传 reactive 对象/ref 本体（rawRef）/装 ref 的
// 容器,消费端在 render 里读取这些响应式数据即自动收集依赖、随变化更新。
// ============================================================

import { type Context } from '@actview/core'

export function useContext<T>(context: Context<T>): T {
  return context.use()
}
