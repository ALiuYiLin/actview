# 能力差距分析 — ActView vs React / Vue

> 定位：**ActView = Vue 3 响应式内核（Proxy effect + computed/watch）+ React 风格 JSX 组件写法 + 自研 VNode/diff 渲染器**。
> 因此"缺什么"分两条对标线：对标 **Vue 3** 缺的是响应式体系 / 模板体系 / Options 能力；对标 **React** 缺的是 Hooks 体系 / 并发渲染 / 生态。
>
> 本文由源码通读整理（`packages/core`、`packages/jsx`、`packages/router`、`plugins/*`、`docs/*`），随实现进度更新。

---

## 一、已具备（确认基线）

- **响应式**：`reactive` / `shallowReactive` / `readonly` / `markRaw` / `ref` / `isRef` / `unref` / `toRef` / `toRefs` / `computed` / `watch` / `watchEffect` / `EffectScope`（内部）
- **渲染**：虚拟 DOM + `patch`、keyed diff（LIS 最小移动）、同索引 diff、props 细粒度更新、受控 input 光标保位、批处理 + `nextTick`、运行时短路（props/children 引用短路）、`v-memo`、`<solid>` 细粒度
- **组件**：`createApp().mount`、`defineComponent`（函数形态，props 全量进 setup）、生命周期四件套、插槽（默认/作用域/具名）、动态组件、`KeepAlive`、`ErrorBoundary`、`Suspense`/`lazy`、`Teleport`、`Transition`（简化版）、`provide`/`useInjects`、显式 `{...props}` 透传、模板引用
- **构建/生态**：`renderToString`（静态序列化）、`@actview/router`（最小）、`@actview/plugin-vite`、`@actview/babel-plugin-actview`、`@actview/plugin-scoped`、TS 类型（泛型推导 + 基础 IntrinsicElements）

---

## 二、缺失能力清单

### 1. 响应式系统（对标 Vue 3）— 差距最明确

| 能力 | 现状 | 说明 |
|---|---|---|
| `Map` / `Set` / `WeakMap` / `WeakSet` 响应式代理 | ❌ 缺失 | `reactive` 只代理普通对象/数组，`Date`/`Map`/`Set` 直接返回原值（`reactive.ts` 的 `shouldProxy`） |
| `isReactive` / `isReadonly` / `isProxy` / `toRaw` | ❌ 缺失 | 运行时无法判断代理身份、取原始对象 |
| `shallowRef` / `shallowReadonly` / `triggerRef` / `customRef` | ❌ 缺失 | ref 家族只有 `ref`/`toRef`/`toRefs` |
| ref 在 reactive 内自动解包 | ❌ 缺失 | `reactive({ a: ref(1) }).a` 不会自动 `.value` |
| `watch` 选项 `deep` / `flush` / `once` / `onTrack` / `onTrigger` | ⚠️ 仅 `immediate` | `deep` 是隐式（对象源默认深遍历），无法显式控制 `flush: 'post' / 'pre' / 'sync'` |
| `onWatcherCleanup` | ❌ 缺失 | 只能通过回调第三参 `onCleanup` |
| 数组 identity 方法 | ❌ 缺失 | `indexOf` / `includes` 传原始对象不会与代理元素 toRaw 匹配 |
| `effectScope()` 公开 API | ⚠️ 半成品 | 内部有 `EffectScope`，未暴露 `effectScope()` / `onScopeDispose()` 供手动管理 |
| `toValue` / `isShallow` | ❌ 缺失 | Vue 3.3+ 工具 |

> 本条线即 `docs/bugs.md` 已承认的差距，优先级最高。

### 2. 渲染器 / DOM 层

| 能力 | 现状 | 说明 |
|---|---|---|
| SVG 命名空间渲染 | ❌ 缺失 | 用 `document.createElement`，无 `createElementNS`，`<svg><path>` 无法渲染（`docs/API.md` 已列为待办） |
| `dangerouslySetInnerHTML` / innerHTML | ❌ 缺失 | 无法插入 HTML 字符串 |
| 事件修饰符（`passive` / `once` / `stop` / `prevent`） | ❌ 缺失 | 只有 `capture`，无 `passive`/`once` |
| 合成事件 / 事件对象标准化 | ❌ 缺失 | 直接绑原生 `addEventListener`，无 React SyntheticEvent 跨浏览器包装 |
| 表单双向绑定（`v-model` 等价物） | ❌ 缺失 | 需手写 `value + onInput`，无便捷指令 |
| 编译期静态提升 / block tree / patchFlag | ❌ 缺失 | 有运行时短路，但无 Vue 3 编译器的静态节点提升与动态标记 |
| 自定义指令（directive） | ❌ 缺失 | 无 `v-xxx` 指令体系（`v-memo`/`<solid>` 是编译期特例，非通用机制） |

### 3. 组件运行时

| 能力 | 现状 | 说明 |
|---|---|---|
| Options API | ❌ 缺失 | 无 `data`/`computed`/`methods`/`watch`/`props` 声明式写法，只有 `setup` |
| props 校验 / 默认值 / validator | ❌ 缺失 | `props` 只有 `readonly string[]` 白名单，无类型/默认/校验 |
| `emits` 声明 + 自定义事件 | ❌ 缺失 | 无 `$emit`，只能靠 `onXxx` 回调 prop（React 风格） |
| `defineExpose` / `expose` | ❌ 缺失 | 组件 ref 直接暴露整个 instance，无法控制对外 API（React `useImperativeHandle` 同理） |
| `onBeforeMount` / `onActivated` / `onDeactivated` / `onErrorCaptured` / `onRenderTracked` / `onRenderTriggered` / `onServerPrefetch` | ❌ 缺失 | 生命周期只有四件套 + `getCurrentInstance` |
| `KeepAlive` 的 `include` / `exclude` / `max` | ❌ 缺失 | 只支持全量缓存 |
| `Transition` 的 `mode`（out-in/in-out）/ `appear` / `TransitionGroup` / JS 钩子 | ❌ 缺失 | 只支持单子节点 enter/leave 类 |
| `Teleport` 的 `disabled` / `defer` | ❌ 缺失 | 只有 `to` |
| Suspense 异步 setup / 嵌套 / 错误处理 | ❌ 缺失 | 只支持 `lazy()` 一种异步场景 |

### 4. React Hooks 等价物（对标 React）

| React | ActView 现状 |
|---|---|
| `useState` / `useReducer` | `ref` / `reactive` ✅（但无 reducer 语义） |
| `useMemo` | `computed` ✅ |
| `useEffect` | `watch` / `watchEffect` ✅ |
| `useRef` | `ref` ✅ |
| `useContext` | `provide` / `useInjects` ✅ |
| `useCallback` | 天然稳定 ✅ |
| `useLayoutEffect` | ❌ 缺失（同步 DOM 后副作用） |
| `useImperativeHandle` | ❌ 缺失 |
| `useId` | ❌ 缺失（无障碍/SSR id 生成） |
| `useSyncExternalStore` | ❌ 缺失（订阅外部 store） |
| `useTransition` / `useDeferredValue` | ❌ 缺失（并发渲染相关） |
| `useDebugValue` | ❌ 缺失 |
| `memo` | ⚠️ 只有 `v-memo` 指令，无组件级 memo |
| `forwardRef` | ⚠️ 部分（`props.ref` 可指向实例，但无 expose 控制） |
| `StrictMode` / `Profiler` | ❌ 缺失 |
| Context 类型推断 | ⚠️ `provide` 用 string key，无类型推导 |

### 5. 路由（对标 Vue Router / React Router）— 差距很大

当前 `@actview/router` 约 300 行，是**组件切换级最小实现**。

| 能力 | 现状 |
|---|---|
| 嵌套路由 / 命名视图 | ❌ |
| 路由守卫（`beforeEach` / `beforeRouteEnter` / `beforeRouteLeave` 等） | ❌ |
| 命名路由 / 别名 / 重定向 | ❌ |
| 路由 meta / `props: true` 传参 | ❌ |
| 懒加载 + 代码分割集成 | ❌（需手动 `lazy`，router 不认识） |
| hash history | ❌（只有 web / memory） |
| `scrollBehavior` 滚动控制 | ❌ |
| 导航失败 / 取消处理 | ❌ |
| 与 `KeepAlive` 集成的页面缓存 | ❌ |
| 通配符 / 404 优雅处理 | ⚠️（match 返回 null，无专门兜底） |

### 6. 状态管理 & 生态（最大短板）

| 能力 | 现状 |
|---|---|
| 官方状态管理库 | ❌ 无 Pinia / Zustand / Redux 等价物，只有裸 `provide` / `inject` |
| DevTools | ❌ 无调试面板（React / Vue 都有） |
| SSR / hydration | ❌ `renderToString` 只是静态序列化，**没有水合（hydrate）** |
| 流式 SSR / streaming | ❌ |
| 框架专用测试工具库 | ❌（有 vitest，但无 `@vue/test-utils` / testing-library 等价） |
| UI 组件库 / 生态 | ❌ |
| i18n / 表单库 / 动画库等 | ❌ |
| HMR 组件级热更新（保留状态） | ❌ |
| Web Components / custom elements | ❌ |

### 7. 类型系统（工程化）

| 能力 | 现状 |
|---|---|
| 完整 `IntrinsicElements` | ❌ 只有 `input` + 通用 `HtmlProps` 索引签名，无完整 HTML 元素/属性类型 |
| SVG 元素类型 | ❌ |
| ARIA 属性类型 | ❌（React / Vue 都有完整 `aria-*`） |
| 完整事件类型 | ⚠️ 只有十几个常用事件，无 SyntheticEvent 全量 |

---

## 三、P0 落地清单（已确认范围）

### 3.1 本轮要做（P0）

**A. 响应式系统补齐**

| # | 事项 | 说明 |
|---|---|---|
| 1 | `Map` / `Set` / `WeakMap` / `WeakSet` 响应式代理 | 补 `reactive` 集合类型支持（`shouldProxy` 扩展 + 集合方法 instrumentation） |
| 2 | `toRaw` / `isReactive` / `isReadonly` / `isProxy` | 判型工具（依赖 #7 的 identity 比较） |
| 3 | `shallowRef` / `shallowReadonly` | 浅层 ref 与只读代理 |
| 4 | `triggerRef` | 手动触发 `shallowRef` 依赖（`customRef` 砍，见 3.2） |
| 5 | `watch` 的 `flush`（`pre`/`post`/`sync`）/ `deep` / `once` | 补齐 watch 选项（`onTrack`/`onTrigger` 砍，见 3.2） |
| 6 | `onWatcherCleanup` | 独立注册清理回调 |
| 7 | 数组 identity 方法 | `indexOf` / `includes` / `lastIndexOf` 对 reactive 元素的 toRaw 比较 |
| 8 | `effectScope()` / `onScopeDispose()` 公开 API | 暴露手动作用域管理 |
| 9 | `toValue` / `isShallow` | 取值统一 + 浅层判型 |

**B. 渲染器 / DOM 层**

| # | 事项 | 说明 |
|---|---|---|
| 10 | SVG 命名空间渲染 | `createElementNS`，`<svg>`/`<path>` 可用 |
| 11 | `dangerouslySetInnerHTML` | HTML 字符串插入 |
| 12 | 事件修饰符 `passive` | 滚动性能关键，无法用闭包替代（`once` 砍，见 3.2） |

### 3.2 暂不进行（本轮不做）

| 事项 | 决策原因 |
|---|---|
| ref 在 reactive 内自动解包 | 不迁就 React 式写法，保持显式 `.value` |
| 表单双向绑定（v-model 等价物） | 减少语法糖，`value + onInput` 数据流更清晰 |
| 编译期静态提升 / block tree / patchFlag | 性能优化后置，后续再做 |
| `customRef` | 高级底层 API，精简路线砍掉 |
| 事件修饰符 `once` | 纯语法糖，可用闭包实现 |
| 合成事件标准化（SyntheticEvent） | 保持原生事件直连，不引入跨浏览器包装 |
| `watch` 的 `onTrack` / `onTrigger` | 纯调试用途，后置 |

### 3.3 后续（P1 / P2）

#### P1-1：组件契约对齐 React（方案 3）— 移除 props/attrs 分离与自动透传

> 设计纠偏：ActView 是 TSX 写法，props 形状由 TS 类型（`export type AppProps` + `function App(props: AppProps)`）在编译期保证，**不需要** Vue 的 props 校验 / `emits` / `ctx.attrs` / 自动 fallthrough。
> 回调通过 props 定义函数（父组件直接传），不引入 `emits`。

| 移除 | 说明 |
|---|---|
| `defineComponent` options 形态 props 白名单 / `inheritAttrs` | `__props` / `__inheritAttrs` 删除，统一 `defineComponent(setup)` |
| `splitProps` / `collectAttrs` / `mergeAttrsToRoot` | props/attrs 分离与自动 fallthrough 删除 |
| `useAttrs` | 语义消失，删除 |
| Babel `extractPropsFromType` | 不再生成 props 白名单 |

**结果语义（对齐 React）**：

- `setup(props)` 收到**全部**传入属性（`key`/`ref` 除外，`children` 在 `props.children`）
- 框架**不自动透传**，用户显式 `{...props}` 选择继承（含 scoped `data-v-*` 跨文件继承）
- 条件渲染 / Fragment 多根的「根元素识别」问题不存在——落点是用户显式行为
- TS 类型别名（`props: AppProps`）与内联类型行为一致（运行时不再依赖 props 名单）

#### P1-2：路由守卫 + 嵌套路由 + 懒加载集成

1. 嵌套路由（`children` + 嵌套 `<RouterView>`）
2. 路由守卫（`beforeEach` / `afterEach` + `beforeEnter`）
3. 懒加载集成（`component: () => import(...)` 与 `lazy`/`Suspense` 打通）

#### P2

1. **状态管理 / DevTools / hydration**：生态层，决定能否被真实项目采用。
2. **完整 TS 类型**：IntrinsicElements、SVG、ARIA、事件全量。
