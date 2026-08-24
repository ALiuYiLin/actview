// ============================================================
// @actview/hooks-react — React hooks 的 ActView 实现
//
// 目的：加快 React 生态迁移。组件函数体 ≈ ActView 的 setup（只执行一次），
// 返回值统一为 **ref 活引用**（JSX 自动解包，渲染处零改动；逻辑处 .value）。
//
//   A. 直接转换（语义等价）：useState useReducer useRef useMemo useCallback
//      useContext useId useDebugValue useSyncExternalStore
//   B. 语义有差异：useEffect（post 异步）/ useLayoutEffect / useInsertionEffect
//      （无同步布局阶段，降级 post）/ useImperativeHandle（onMounted 覆盖句柄）
//   C. 并发降级：useTransition（同步执行）/ useDeferredValue（无延迟透传）
//
// 不提供：use()（promise 分支）、useFormStatus、useActionState、useOptimistic
// （React DOM form actions / 并发专属，ActView 无对应运行时）。
// ============================================================

export { useState, useReducer, type SetStateAction } from './useState'
export { useRef, useImperativeHandle, type ReactLikeRef } from './useRef'
export { useMemo, useCallback } from './useMemo'
export { useEffect, useLayoutEffect, useInsertionEffect } from './useEffect'
export { useContext } from './useContext'
export {
  useSyncExternalStore,
  useId,
  useDebugValue,
  useTransition,
  useDeferredValue,
} from './useStore'
