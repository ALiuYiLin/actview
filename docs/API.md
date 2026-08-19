# ActView 能力与 API 清单

> 框架 = 响应式系统 + JSX 渲染器 + 组件运行时 + 路由/生态。
> 统一入口：`import { ... } from 'actview'`（聚合 `@actview/core` 的公开 API）。

---

## 一、响应式系统（reactivity）

### 状态容器

| API | 说明 |
|---|---|
| `reactive(obj)` | 深度响应式代理（对象/数组/`Map`/`Set`/`WeakMap`/`WeakSet`；`for...in`、数组方法均响应） |
| `shallowReactive(obj)` | 浅层响应式（仅第一层） |
| `readonly(obj)` | 只读代理（赋值 warn） |
| `shallowReadonly(obj)` | 浅只读（第一层只读，嵌套可写） |
| `markRaw(obj)` | 标记跳过代理 |
| `ref(value)` | 单值响应式（`.value`） |
| `shallowRef(value)` | 浅层 ref（对象值不包装） |
| `triggerRef(ref)` | 手动触发 shallowRef 依赖 |
| `isRef(v)` / `unref(v)` / `unrefs(obj)` | ref 判断 / 解包 / 批量解包（`{y: Ref}` → `{y: value}`，配合 `toRefs` 解构 rest 透传） |
| `toValue(v)` | 取值统一（值/ref/getter） |
| `toRef(obj, key)` / `toRefs(obj)` | 对象属性/整体转 ref |

### 判型工具

| API | 说明 |
|---|---|
| `toRaw(v)` | 递归取原始对象 |
| `isReactive(v)` / `isReadonly(v)` / `isProxy(v)` / `isShallow(v)` | 代理身份判断 |

### 派生与侦听

| API | 说明 |
|---|---|
| `computed(getter)` / `computed({ get, set })` | 惰性缓存派生值（脏标记）；选项形态支持 setter |
| `watch(source, cb, opts?)` | 侦听（ref/函数/数组/对象；`deep`/`flush`/`once`/`immediate`；`onCleanup`；返回 stop） |
| `watchEffect(fn, opts?)` | 立即执行并自动追踪依赖（⚠️ 回调内早退前先读取要追踪的依赖，否则不会收集——见 `docs/reactivity.md` 4.3） |
| `onWatcherCleanup(fn)` | 回调内注册清理 |

### 作用域

| API | 说明 |
|---|---|
| `effectScope(detached?)` | 创建作用域 |
| `onScopeDispose(fn)` | 注册清理（stop 时执行） |
| `getCurrentScope()` | 当前作用域 |

### 调度

| API | 说明 |
|---|---|
| `nextTick(cb?)` | 本轮 flush 后回调 |
| `runEffect(fn, { scheduler, instance })` | 创建 ReactiveEffect 并立即执行 |
| `track` / `trigger` / `pauseTracking` / `resetTracking` | 手动依赖收集/派发（底层） |

---

## 二、组件

### 创建与挂载

| API | 说明 |
|---|---|
| `createApp(Component).mount('#app')` | 创建并挂载应用 |
| `defineComponent(setup, name?)` | 组件包装（Babel 插件自动转换 + 组件名） |
| `defineComponent({ setup, name? })` | options 形态 |

### 生命周期钩子（全套）

| API | 触发时机 |
|---|---|
| `onBeforeMount(fn)` | 首次 render 前 |
| `onMounted(fn)` | DOM 挂载后（子先父后） |
| `onUpdated(fn)` | 每次重渲染后 |
| `onBeforeUnmount(fn)` | 卸载前 |
| `onUnmounted(fn)` | 卸载完成后 |
| `onActivated(fn)` | KeepAlive 缓存恢复 |
| `onDeactivated(fn)` | KeepAlive 移入缓存 |
| `onErrorCaptured(fn)` | 捕获子组件错误（返回 false 停止传播） |
| `onServerPrefetch(fn)` | renderToString 阶段 |
| `onRenderTracked(fn)` | 依赖收集（调试） |
| `onRenderTriggered(fn)` | 依赖触发（调试） |
| `getCurrentInstance()` | 当前组件实例 |
| `useId()` | 生成稳定的唯一 id（React useId 场景）：客户端基于组件实例自增 id（setup 只执行一次 → 重渲染间稳定）+ 调用计数；SSR/setup 外回退全局计数。无水合，服务端/客户端 id 无需一致 |

### 内置组件

| 组件 | 说明 | 详细参考 |
|---|---|---|
| `<KeepAlive include/exclude/max>` | 缓存实例/DOM（组件名过滤 + LRU 上限） | [→ components.md](./components.md#4-keepalive--组件实例缓存) |
| `<ErrorBoundary fallback={...}>` | 捕获渲染错误 | [→ components.md](./components.md#5-errorboundary--渲染错误边界) |
| `<Suspense fallback={...}>` | 异步 setup / lazy 加载期间显示 fallback | [→ components.md](./components.md#6-suspense--异步加载占位) |
| `<Teleport to="#target">` | 传送门 | [→ components.md](./components.md#3-teleport--dom-传送门) |
| `<Transition name mode appear onEnter/onLeave...>` | 单子节点过渡（mode out-in + JS 钩子） | [→ components.md](./components.md#1-transition--单子节点过渡动画) |
| `<TransitionGroup name>` | 列表增删过渡 | [→ components.md](./components.md#2-transitiongroup--列表过渡动画) |
| `<component is={Comp}>` | 动态组件 | [→ components.md](./components.md#9-component--动态组件) |
| `lazy(() => import(...))` | 异步组件 | [→ components.md](./components.md#7-lazy--异步组件工厂) |

### 组件特性

| 能力 | 说明 |
|---|---|
| Props | 全量进 setup（`key`/`ref` 除外），TS 类型保证形状；显式 `{...props}` 透传 |
| Props 响应式取值 | `useProp(key, fn?)` / `useProps({ key: fn })`（组件内单参形式，自动取当前实例 props；也支持 `useProp(props, key, fn?)` / `useProps(props, { key: fn })` 显式传入）：返回 ComputedRef 活引用（解决 setup 解构快照），`fn` 做默认值/转换；map 值为 `undefined` 时该键裸透传（直接返回 props 原值）；批量版附带 `rest`（未声明键集合，可 `{...rest.value}` 透传，父新增 prop 键自动进入） |
| 插槽 | 默认（children）/ 作用域（函数 children）/ 具名（`<template slot="name">`） |
| 模板引用 | `props.ref`（函数 / `{value}` 对象 / `ref()`——Vue 风格直接传）指向 DOM/组件实例，卸载自动置 null |
| 依赖注入 | `provide(key, value)` / `useInjects(key?)`（字符串键）；`createContext(default)`（React 风格：对象身份即键，无碰撞） |
| Context | `createContext<T>(default)` → `<Ctx.Provider value={v}>` / `<Ctx value={v}>`（React 19 风格）/ `Ctx.use()`（返回 Ref，render 读 `.value`；value 变化消费方自动重渲染；就近覆盖；SSR 可用） |
| 组件名 | `defineComponent(fn, name)` / Babel 从变量名传递（KeepAlive/DevTools 用） |

---

## 三、渲染与更新（renderer）

| 能力 | 说明 |
|---|---|
| keyed diff | LIS 最小移动（`getSequence`） |
| 同索引 diff | 无 key 列表逐位 patch |
| props 细粒度更新 | `patchProps`/`setProp`（class/style/value/checked/事件/属性） |
| SVG 命名空间 | `createElementNS` |
| `dangerouslySetInnerHTML` | HTML 字符串插入 |
| 事件 | `onClick`/`onclick`/`onXxxCapture`/`onXxxPassive`（invoker 缓存） |
| 受控 input 光标保位 | 更新 value 前后恢复 selection |
| 调度批处理 | `queueJob` 微任务去重 + `nextTick` |
| 运行时短路 | props 值/引用短路、children 引用短路 |
| `v-memo` | 行级显式依赖短路 |
| `<solid>` 双模 | `createEffect`/`mapArray`/`solidGet` |
| `renderToString` | VNode → HTML 静态序列化 |

---

## 四、路由（@actview/router）

| API | 说明 |
|---|---|
| `createRouter({ history, routes })` | 创建路由 |
| `createWebHistory(base?)` / `createMemoryHistory()` | history 模式 |
| `<RouterLink to>` / `<RouterView />` | 链接 / 出口（嵌套） |
| `router.push/replace/back/forward/go` | 导航 |
| `router.beforeEach(guard)` / `router.afterEach(hook)` | 全局守卫 |
| `RouteRecord.beforeEnter` / `redirect` / `meta` / `children` | 路由级守卫/重定向/元信息/嵌套 |
| `currentRouter` | 当前路由实例 |

---

## 五、生态

| 包 | API |
|---|---|
| `@actview/store` | `defineStore`/`applyPlugin`/`resetStore`/`resetAllStores`/`getActiveStoreIds`/`getStore` |
| `@actview/testing` | `render`/`fireEvent`/`waitFor`/`screen`/`cleanup` |
| `@actview/devtools` | `initDevTools`/`mountPanel` |

---

## 六、工程化（@actview/plugin-vite + @actview/plugin-babel）

| 能力 | 说明 |
|---|---|
| `actviewPlugin()`（Vite） | `.tsx` 过 Babel 做 defineComponent 转换 |
| `defineComponentPlugin`（Babel） | 组件函数 → `defineComponent`；具名插槽；组件名传递 |
| `@actview/plugin-scoped` | scoped CSS（`data-v` 哈希 + `:deep`/`:slotted`/`:global`） |
