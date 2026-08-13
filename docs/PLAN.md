# 开发计划 — 里程碑总结与后续方向

> 历史开发计划已全部落地，本文档收敛为「已完成里程碑」+「下一阶段」。
> 详细的能力差距与计划见 `docs/gap-analysis.md`。

---

## 一、已完成里程碑

### 早期（响应式内核 + 渲染器）

| 里程碑 | 内容 |
|---|---|
| 数据层 | 数组方法 instrumentation、`for...in`/`in` 响应、`computed`/`ref`/`watch`、调度批处理 + `nextTick`、`shallowReactive`/`readonly`/`markRaw` |
| 渲染层 | keyed diff（LIS 最小移动）、受控 input 光标保位、事件系统（addEventListener + capture + invoker） |
| 组件能力 | 生命周期钩子、插槽（默认/作用域/具名）、动态组件、`KeepAlive`、`ErrorBoundary`、`Suspense`/`lazy`、`ref` 模板引用 |
| 工程化 | vitest + happy-dom 迁移、类型泛型化（`ComponentType`/`PropsOf`）、`renderToString` |
| 性能 | 运行时短路（props/children 引用）、`v-memo`、`<solid>` 双模细粒度（`mapArray`） |

### P0 — 响应式补齐 + 渲染硬缺口

- `Map`/`Set`/`WeakMap`/`WeakSet` 代理、`toRaw`/`isReactive`/`isReadonly`/`isProxy`/`isShallow`
- `shallowRef`/`shallowReadonly`/`triggerRef`、`watch` 的 `flush`/`deep`/`once`、`onWatcherCleanup`
- 数组 identity 方法、`effectScope`/`onScopeDispose`、`toValue`
- SVG 命名空间、`dangerouslySetInnerHTML`、事件 `passive`

### P1 — 组件契约 / 路由 / 类型 / 运行时增强

| 里程碑 | 内容 |
|---|---|
| P1-1 组件契约对齐 React | 移除 props/attrs 分离与自动透传（方案 3），props 全量进 setup，显式 `{...props}` |
| P1-2 路由 | 嵌套路由、守卫（`beforeEach`/`afterEach`/`beforeEnter`）、`redirect`/`meta`、懒加载 |
| P1-3 TS 类型 | 完整 `IntrinsicElements`（HTML + SVG）、ARIA、完整事件、组件 props 严格化 |
| P1-4 组件运行时 | `KeepAlive`（`include`/`exclude`/`max`）、`Transition`（`mode`/`appear`/JS 钩子）、`TransitionGroup`、`Suspense`（异步 setup）、生命周期补全（7 钩子） |

### 生态

| 包 | 内容 |
|---|---|
| `@actview/store` | 状态管理（`defineStore` 单例 + 插件 + reset） |
| `@actview/testing` | 测试工具（`render`/`fireEvent`/`waitFor`/`screen`/`cleanup`） |
| `@actview/devtools` | 调试后端 + 面板（core 埋点 + 组件树/事件流 + window hook） |

---

## 二、下一阶段

### SSR / hydration（计划中）

`renderToString` 目前仅静态序列化，缺客户端水合。分阶段：

1. SSR 状态序列化（`window.__INITIAL_STATE__`）
2. `hydrate`（复用已有 DOM，只绑事件 + 建 effect）
3. 异步数据预取（`onServerPrefetch` 异步收集 + await）
4. 流式 SSR

> 详细见 `docs/gap-analysis.md` 第四节。
