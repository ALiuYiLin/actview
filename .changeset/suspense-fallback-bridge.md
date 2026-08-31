---
"actview": minor
---

Suspense 支持 React 语义的 `fallback` prop（桥接为 vue `#fallback` 插槽）

- 此前 `<Suspense fallback={<X />}>children</Suspense>` 的 fallback prop 被 vue 忽略（隐藏缺口，异步期间无 fallback 展示）
- 新增 actview 版 `Suspense` 组件 + `SuspenseProps` 类型：`fallback`（vnode）接到 `#fallback` 插槽，children 走默认插槽；其余 props（onResolve / onPending / onFallback / timeout 等）透传 vue Suspense
