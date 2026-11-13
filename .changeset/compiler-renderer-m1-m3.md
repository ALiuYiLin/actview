---
"@actview/core": minor
"actview": minor
---

ActView 类组件化与渲染器 M1–M3 落地：

- `@actview/core`：实现 DOM 渲染器 M1–M3（createApp、组件级 re-render、keyed + LIS diff、provide/inject、public instance proxy、完整 patchProp、错误边界、Suspense/lazy、Teleport/Transition/KeepAlive、DevTools）；组件模型统一为 `@Component` 类 + `@Prop/@Ref/@Reactive/@Computed/@Watch/@Provide/@Inject` 装饰器；内置组件类化。
- `actview`：新增用户聚合入口（只导出面向应用的 API，不导出 reactivity 内部函数）。
- 移除 `@actview/runtime-core`（类型/工厂并入 core）与 `@actview/compiler`（L1 wrap 阶段删除，Babel 保留为根依赖）。
