// ============================================================
// useEffect / useLayoutEffect / useInsertionEffect — 副作用
//
// useEffect(fn, deps?)：
//   - 不传 deps → watchEffect(fn, { flush: 'post' })：自动追踪，依赖变化重跑
//   - deps=[]    → 只执行一次（watch getter 恒返回 []，immediate 触发一次）
//   - deps=[a,b] → watch deps（自动 toValue 解包），任一变化重跑
//   - flush 'post'：DOM 更新后（nextTick）执行——对齐 React commit 后执行
//   - 清理函数：fn 返回 () => void → onWatcherCleanup 注册；
//     重跑前与组件卸载时都会执行（onStop 机制）——React 语义完全对齐
//
// useLayoutEffect：ActView 无"DOM 变更后同步"的布局阶段，降级为 post
//   （DOM 已更新，读尺寸/测 DOM 可用；异步而非同步，需注意）。
// useInsertionEffect：CSS-in-JS 同步注入，无对应阶段，降级为 useEffect。
// ============================================================

import { watch, watchEffect, onWatcherCleanup, toValue } from '@actview/core'

type EffectCallback = () => void | (() => void)

function runWithCleanup(effect: EffectCallback) {
  const cleanup = effect()
  if (typeof cleanup === 'function') onWatcherCleanup(cleanup as () => void)
}

export function useEffect(effect: EffectCallback, deps?: unknown[]): void {
  if (deps === undefined) {
    watchEffect(() => runWithCleanup(effect), { flush: 'post' })
  } else {
    watch(
      () => deps.map((d) => toValue(d)),
      () => runWithCleanup(effect),
      { flush: 'post', immediate: true }
    )
  }
}

export function useLayoutEffect(effect: EffectCallback, deps?: unknown[]): void {
  useEffect(effect, deps)
}

export function useInsertionEffect(effect: EffectCallback, deps?: unknown[]): void {
  useEffect(effect, deps)
}
