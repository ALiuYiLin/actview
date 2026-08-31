// ============================================================
// AvatarRoot 上下文 —— 基于 ActView createContext（对齐 base-ui 语义）
//
// React 版:React.createContext + Provider 包裹 + useContext 读取。
// ActView 版:createContext 返回的 ctx 自带 .Provider 组件与 .use() 消费——
// 与 React 心智一一对应;内部由框架的 provide/injects 机制实现
// （ctx.Provider 的 setup 期 provide,后代组件经 injects 链继承）。
//
// 值形态:payload 用 reactive 载体 + 原始值字段（imageLoadingStatus 为普通
// 字符串,非 ref）——读走 get 陷阱 track、写走 set 陷阱 trigger,消费端
// `ctx.imageLoadingStatus` 直接拿值,无需 .value 链。
// setImageLoadingStatus 是【统一写入口】（软约束）:所有变更集中走此方法,
// 调试时改值来源一目了然;技术上绕过它直接赋值也能触发（set 陷阱对任何
// 写入者生效）,属约定而非强制。
// ⚠️ payload 不要再存 ref 本体:reactive get 陷阱【不自动解包 ref】
// （reactive.ts get 无 isRef 分支,与 Vue 不同）→ 存 ref 读出来的还是
// ref 对象,消费端得写 .value 链,反而绕远。
// ============================================================

import { createContext } from '@actview/core'
import type { ImageLoadingStatus } from './AvatarRoot'

export interface AvatarRootContext {
  /** 原始值（reactive 载体:读走 get 陷阱 track、写走 set 陷阱 trigger） */
  imageLoadingStatus: ImageLoadingStatus
  /** 统一写入口（软约束）:所有变更走此方法,调试时一目了然 */
  setImageLoadingStatus: (status: ImageLoadingStatus) => void
}

/** JSX 用法:<AvatarRootContext.Provider value={ctx}>…</AvatarRootContext.Provider> */
export const AvatarRootContext = createContext<AvatarRootContext | undefined>(
  undefined,
)

// ⚠️ payload 不要用 reactive() 包裹:
//  - ActView 的 reactive get 陷阱【不自动解包 ref】（reactive.ts get 无 isRef
//    分支,与 Vue 不同）→ 包裹后 ctx.imageLoadingStatus 读到的仍是 ref 对象,
//    人体工学零变化;
//  - 其 set 陷阱直接覆盖键值 → `ctx.imageLoadingStatus = 'loading'` 会把
//    ref 本体替换成字符串,静默炸掉后续响应性。
// 变更一律走 setImageLoadingStatus / Ref API,勿直接写 payload 的普通属性
// （非 ref 键的写入无响应性）。

/** 由 AvatarImage / AvatarFallback 等子部件在 setup 期调用 */
export function useAvatarRootContext(): AvatarRootContext {
  // store-as-is 语义下 use() 返回注入表中【原样存储】的 payload 对象
  // （AvatarRoot setup 期创建的稳定载体,内部 imageLoadingStatus 为活 Ref——
  //  消费端读 .imageLoadingStatus.value 即建立追踪并随变更更新）
  const ctx = AvatarRootContext.use()
  if (ctx === undefined) {
    throw new Error(
      'Base UI: AvatarRootContext is missing. Avatar parts must be placed within <Avatar.Root>.',
    )
  }
  return ctx
}
