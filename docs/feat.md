# ActView 框架能力清单（当前状态）

## 响应式 API
- `reactive` / `shallowReactive` / `readonly` / `shallowReadonly` / `markRaw`
- `ref` / `shallowRef` / `triggerRef` / `isRef` / `unref` / `toValue` / `toRef` / `toRefs`
- `computed`（只读 getter / 可写 getter+setter）
- `watch`（`flush`/`deep`/`once`）/ `watchEffect` / `onWatcherCleanup`
- `effectScope` / `onScopeDispose` / `getCurrentScope`
- `toRaw` / `isReactive` / `isReadonly` / `isProxy` / `isShallow`
- 深度响应式：嵌套对象、数组方法、`for...in`、`Map`/`Set`/`WeakMap`/`WeakSet`
- 数组 identity 方法（`indexOf`/`includes` toRaw 比较）
- 调度系统：track / trigger / 批处理队列（`queueJob`）/ `nextTick`

## 组件能力
- `createApp().mount()` 应用入口
- `defineComponent`（函数形态 + `name`）
- 生命周期全套：`onBeforeMount` / `onMounted` / `onUpdated` / `onBeforeUnmount` / `onUnmounted` / `onActivated` / `onDeactivated` / `onErrorCaptured` / `onServerPrefetch` / `onRenderTracked` / `onRenderTriggered`
- `getCurrentInstance`
- Props 全量进 setup（`key`/`ref` 除外），TS 类型保证形状；显式 `{...props}` 透传
- 插槽：默认（children）/ 具名（`<template slot>`）/ 作用域（函数 children）
- 模板引用 `ref`（函数或 `{ value }`）
- 动态组件 `<component is={...}>`
- `KeepAlive`（`include`/`exclude`/`max` LRU）
- `ErrorBoundary`（fallback 可函数化）
- `Suspense`（异步 setup/嵌套）+ `lazy()`
- `Teleport` / `Transition`（`mode`/`appear`/JS 钩子）/ `TransitionGroup`
- `Fragment`
- `provide` / `useInjects`

## 渲染器
- 虚拟 DOM + `patch`（mount / update / unmount）
- keyed diff：LIS 最长递增子序列最小移动
- 同索引 diff、文本节点、受控 input 光标保位
- SVG 命名空间（`createElementNS`）、`dangerouslySetInnerHTML`
- 事件系统：`addEventListener` + `capture`/`passive` + invoker 复用
- 运行时短路：props 值比较 / props 引用 / children 引用
- `v-memo` 行级显式依赖短路
- `<solid>` 双模细粒度（`createEffect`/`mapArray`/`solidGet`）
- `renderToString`（VNode → HTML 静态序列化）

## 路由（@actview/router）
- `createRouter` / `createWebHistory` / `createMemoryHistory`
- `RouterLink` / `RouterView`（嵌套，depth 传递）
- 嵌套路由（`children`）
- 守卫：`beforeEach` / `afterEach` / `beforeEnter`
- `redirect` / `meta` / 懒加载（`component: () => import()` + `Suspense`）

## 生态
- `@actview/store`：状态管理（`defineStore` 单例 + 插件 + reset）
- `@actview/testing`：测试工具（`render`/`fireEvent`/`waitFor`/`screen`/`cleanup`）
- `@actview/devtools`：调试后端 + 面板（`initDevTools`/`mountPanel`）

## JSX 与类型（@actview/jsx）
- JSX 扩展语法（`jsx`/`jsxs`/`jsxDEV`/`createElement`/`isValidElement`）
- 完整 `IntrinsicElements`（全量 HTML + SVG）
- ARIA 属性（`aria-*`）、`data-*` 属性
- 完整事件类型（camelCase + capture + 小写兼容）
- 组件 props 严格化（`LibraryManagedAttributes = P & HTMLAttributes`）

## 构建期与工程
- `@actview/plugin-vite`：Vite 插件（defineComponent 转换接入）
- `@actview/babel-plugin-actview`：组件自动 defineComponent 转换 + 具名插槽 + 组件名传递
- `@actview/plugin-scoped`：scoped CSS（`data-v` 哈希 + `:deep`/`:slotted`/`:global`）
- TypeScript 支持（tsup 构建、d.ts 导出）
