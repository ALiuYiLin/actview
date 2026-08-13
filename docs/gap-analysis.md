# 能力差距分析 — ActView vs React / Vue（当前状态）

> 定位：**ActView = Vue 3 响应式内核（Proxy effect + computed/watch）+ React 风格 JSX 组件写法 + 自研 VNode/diff 渲染器**。
> 因此"缺什么"分两条对标线：对标 **Vue 3** 缺的是模板体系 / Options 能力；对标 **React** 缺的是并发渲染 / 部分 Hooks / 生态。
>
> 本文随实现进度更新：已完成的里程碑见「三」，仍缺失的见「二」，下一阶段计划见「四」。

---

## 一、已具备（当前完整能力）

- **响应式**：`reactive` / `shallowReactive` / `readonly` / `shallowReadonly` / `markRaw` / `ref` / `shallowRef` / `triggerRef` / `isRef` / `unref` / `toValue` / `toRef` / `toRefs` / `computed` / `watch`（`flush`/`deep`/`once`）/ `watchEffect` / `onWatcherCleanup` / `effectScope` / `onScopeDispose` / `toRaw` / `isReactive` / `isReadonly` / `isProxy` / `isShallow`
- **响应式进阶**：`Map`/`Set`/`WeakMap`/`WeakSet` 代理、数组 identity 方法（`indexOf`/`includes` toRaw 比较）、`for...in`/`in` 响应、调度批处理 + `nextTick`
- **渲染**：虚拟 DOM + `patch`、keyed diff（LIS 最小移动）、同索引 diff、props 细粒度更新、受控 input 光标保位、SVG 命名空间、`dangerouslySetInnerHTML`、事件 `capture`/`passive`、运行时短路、`v-memo`、`<solid>` 细粒度
- **组件**：`createApp().mount`、`defineComponent`（函数形态 + `name`）、生命周期全套（`onBeforeMount`/`onMounted`/`onUpdated`/`onBeforeUnmount`/`onUnmounted`/`onActivated`/`onDeactivated`/`onErrorCaptured`/`onServerPrefetch`/`onRenderTracked`/`onRenderTriggered`）、插槽（默认/作用域/具名）、动态组件、`KeepAlive`（`include`/`exclude`/`max`）、`ErrorBoundary`、`Suspense`（异步 setup/嵌套）/`lazy`、`Teleport`、`Transition`（`mode`/`appear`/JS 钩子）、`TransitionGroup`、`provide`/`useInjects`、显式 `{...props}` 透传、模板引用
- **路由**（`@actview/router`）：嵌套路由（`children` + 嵌套 `RouterView`）、守卫（`beforeEach`/`afterEach`/`beforeEnter`）、`redirect`/`meta`、懒加载（`component: () => import()` + `Suspense`）、`RouterLink`/`RouterView`
- **类型系统**（`@actview/jsx`）：完整 `IntrinsicElements`（全量 HTML + SVG）、ARIA 属性、完整事件类型、组件 props 严格化（`LibraryManagedAttributes = P & HTMLAttributes`）
- **生态**：`@actview/store`（状态管理）、`@actview/testing`（测试工具）、`@actview/devtools`（调试后端 + 面板）
- **构建/工程**：`renderToString`（静态序列化）、`@actview/plugin-vite`、`@actview/babel-plugin-actview`、`@actview/plugin-scoped`

---

## 二、仍缺失（尚未实现）

### 1. 响应式（已明确砍掉 / 后置）

| 能力 | 状态 | 决策 |
|---|---|---|
| ref 在 reactive 内自动解包 | ❌ 砍 | 不迁就 React 式写法，保持显式 `.value` |
| `customRef` | ❌ 砍 | 高级底层 API，精简路线砍掉 |

### 2. 渲染器 / DOM

| 能力 | 状态 | 决策 |
|---|---|---|
| 表单双向绑定（v-model 等价物） | ❌ 砍 | 减少语法糖，`value + onInput` 数据流更清晰 |
| 合成事件（SyntheticEvent） | ❌ 砍 | 保持原生事件直连 |
| 编译期静态提升 / block tree / patchFlag | ❌ 后置 | 性能优化，后续再做 |
| 自定义指令（directive）体系 | ❌ | 无 `v-xxx` 通用机制（`v-memo`/`<solid>` 是编译期特例） |

### 3. 组件 / React Hooks 等价物

| 能力 | 状态 |
|---|---|
| Options API（`data`/`methods`/`computed` 声明式） | ❌ 只有 setup 组合式 |
| `useLayoutEffect` | ❌ |
| `useImperativeHandle` | ❌ |
| `useId` | ❌ |
| `useSyncExternalStore` | ❌ |
| `useTransition` / `useDeferredValue` | ❌（并发渲染相关） |
| `memo`（组件级） | ⚠️ 只有 `v-memo` 指令 |
| `StrictMode` / `Profiler` | ❌ |
| Context 类型推断 | ⚠️ `provide` 用 string key |

### 4. 路由（`@actview/router` 未实现项）

| 能力 | 状态 |
|---|---|
| hash history | ❌（只有 web/memory） |
| 命名视图 / 命名路由 / 别名 | ❌ |
| `scrollBehavior` 滚动控制 | ❌ |
| 路由 `props: true` 传参 | ❌ |
| 通配符 / 404 优雅处理 | ⚠️（match 返回 null） |

### 5. 生态

| 能力 | 状态 |
|---|---|
| SSR / hydration | ❌ `renderToString` 仅静态序列化，无水合（**下一阶段计划，见「四」**） |
| 流式 SSR / streaming | ❌ |
| UI 组件库 | ❌ |
| i18n / 表单库 / 动画库 | ❌（动画可基于 `Transition`/`TransitionGroup` 自建） |
| HMR 组件级热更新（保留状态） | ❌ |
| Web Components / custom elements | ❌ |

### 6. 类型

| 能力 | 状态 |
|---|---|
| SyntheticEvent 全量类型 | ❌（砍，保持原生事件） |

---

## 三、已完成里程碑

| 里程碑 | 内容 |
|---|---|
| **P0 — 响应式补齐 + 渲染硬缺口** | `Map`/`Set`/`WeakMap`/`WeakSet` 代理、`toRaw`/`isReactive`/`isReadonly`/`isProxy`/`isShallow`、`shallowRef`/`shallowReadonly`/`triggerRef`、`watch` 的 `flush`/`deep`/`once`、`onWatcherCleanup`、数组 identity、`effectScope`/`onScopeDispose`、`toValue`；SVG 命名空间、`dangerouslySetInnerHTML`、事件 `passive` |
| **P1-1 — 组件契约对齐 React（方案 3）** | 移除 props/attrs 分离与自动透传：`splitProps`/`collectAttrs`/`mergeAttrsToRoot`/`useAttrs`/Babel `extractPropsFromType` 删除，props 全量进 setup，用户显式 `{...props}` 透传 |
| **P1-2 — 路由补齐** | 嵌套路由（`children` + 嵌套 `RouterView`）、守卫（`beforeEach`/`afterEach`/`beforeEnter`）、`redirect`/`meta`、懒加载集成 |
| **P1-3 — 完整 TS 类型系统** | 完整 `IntrinsicElements`（HTML + SVG）、ARIA、完整事件、组件 props 严格化 |
| **P1-4 — 组件运行时增强** | `KeepAlive`（`include`/`exclude`/`max` LRU）、`Transition`（`mode`/`appear`/JS 钩子）、`TransitionGroup`、`Suspense`（异步 setup/嵌套）、生命周期补全（7 个钩子） |
| **生态** | `@actview/store`（状态管理）、`@actview/testing`（测试工具）、`@actview/devtools`（调试后端 + 面板） |

> 各模块实现原理见独立文档：`docs/reactivity.md`、`docs/router.md`、`docs/types.md`、`docs/runtime-enhancements.md`、`docs/store.md`、`docs/testing.md`、`docs/devtools.md`。

---

## 四、下一阶段计划：SSR / hydration

> 生态层最后一块大拼图，决定能否被服务端渲染场景采用。工程量大，需框架 + 构建器 + 数据层三者配合，单独立项。

### 现状

- `renderToString`：纯静态序列化（VNode → HTML 字符串，无 DOM/响应式/事件），可用作构建期静态生成。
- 客户端 `createApp().mount`：全新渲染（`host.innerHTML = ''` 后重建 DOM）。
- `onServerPrefetch`：已注册，但当前是同步"尽力而为"（无法等待异步）。

### 分阶段计划

| 阶段 | 内容 | 说明 |
|---|---|---|
| 1 | **SSR 状态序列化** | `renderToString` 输出 `<script>window.__INITIAL_STATE__ = JSON</script>`，客户端读取注入 |
| 2 | **hydrate（水合）** | 新增 `hydrate(vnode, container)`：复用服务端已有 DOM，只绑事件 + 建响应式 effect，不重建 DOM |
| 3 | **异步数据预取** | `onServerPrefetch` 改为异步收集 + `await`（服务端等待所有预取完成再输出） |
| 4 | **流式 SSR** | 边渲染边输出（streaming） |

### hydrate 实现要点（核心难点）

| 点 | 说明 |
|---|---|
| 复用已有 DOM | `mountVNode` 的 `createElement` → hydrate 时按 tag/属性匹配 `container` 已有节点，复用而非重建 |
| 文本节点复用 | 文本 VNode 匹配已有文本节点，值不同才更新 |
| 事件绑定 | 复用 DOM 后走 `patchProps` 绑事件（`addEventListener`） |
| 响应式 effect | 复用 DOM 后建组件实例 + `runEffect`，与 mount 一致 |
| 属性校验 | 服务端与客户端 props 不一致时警告（可选，对齐 React hydration mismatch 语义） |
| 边界 | 组件/Fragment/文本/元素各分支都要区分「挂载」vs「水合」路径 |

### 涉及改动

- `renderer.ts`：新增 `hydrate` 入口，`mountVNode` 拆出「复用已有节点」分支
- `createApp.ts`：`app.mount(selector, isHydrate?)` 或独立 `hydrate(vnode, container)`
- `renderToString.ts`：状态序列化输出
- `@actview/devtools`：SSR 阶段埋点（可选）
