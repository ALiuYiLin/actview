# ActView 能力与 API 清单

> 框架 = 响应式系统 + JSX 渲染器 + 组件运行时 + 路由/插件生态。
> 统一入口：`import { ... } from 'actview'`（聚合 `@actview/core` 的公开 API）。

---

## 一、响应式系统（reactivity）

### 状态容器

| API | 说明 |
|---|---|
| `reactive(obj)` | 深度响应式代理（对象/数组；`for...in`、`'in'`、数组方法均响应） |
| `shallowReactive(obj)` | 浅层响应式（仅第一层） |
| `readonly(obj)` | 只读代理（赋值 console.warn） |
| `markRaw(obj)` | 标记跳过代理（`reactive(raw) === raw`） |
| `ref(value)` | 单个值响应式（`.value` 访问） |
| `isRef(v)` / `unref(v)` | ref 判断 / 自动解包 |
| `toRef(obj, key)` / `toRefs(obj)` | 对象属性/整体转 ref（可解构） |

### 派生与侦听

| API | 说明 |
|---|---|
| `computed(getter)` | 惰性缓存派生值（脏标记） |
| `watch(source, cb, opts?)` | 侦听（支持 ref/函数/数组/对象深度；`immediate`；`onCleanup`；返回 stop） |
| `watchEffect(fn)` | 立即执行并自动追踪依赖（异步批处理触发；返回 stop） |

### 底层（进阶/内部）

| API | 说明 |
|---|---|
| `runEffect(fn, { scheduler })` | 创建 ReactiveEffect 并立即执行 |
| `track` / `trigger` | 手动依赖收集 / 派发（`ITERATE_KEY` 等） |
| `pauseTracking` / `resetTracking` | 暂停/恢复依赖收集（钩子执行、数组方法内部用） |
| `EffectScope` / `getCurrentScope()` | effect 作用域（组件卸载自动 stop watch/computed/render effect） |
| `ReactiveEffect` | effect 类（`scheduler` / `active` / `stop()` / `run()`） |

---

## 二、组件（组件能力）

### 创建与挂载

| API | 说明 |
|---|---|
| `createApp(Component).mount('#app')` | 创建并挂载应用 |
| `defineComponent(setup)` | 组件包装（Babel 插件把 `function App()` 自动转成它） |

组件写法（JSX + 组合式）：

```tsx
function App(props) {
  const state = reactive({ n: 0 })   // setup 体：执行一次
  onMounted(() => console.log('mounted'))
  return () => <div>{state.n}</div>   // 或直接 return JSX（插件自动包 render）
}
```

### 生命周期钩子

| API | 触发时机 |
|---|---|
| `onMounted(fn)` | 首次渲染 DOM 挂载后（子先父后） |
| `onUpdated(fn)` | 每次重渲染后（钩子内暂停依赖收集，防自触发循环） |
| `onBeforeUnmount(fn)` | 卸载前 |
| `onUnmounted(fn)` | 卸载完成后（effect 停止之后） |

### 内置组件

| 组件 | 说明 |
|---|---|
| `<KeepAlive>` | 缓存组件实例/DOM（隐藏容器），切换不销毁、状态保留 |
| `<ErrorBoundary fallback={...}>` | 捕获子树渲染错误，显示 fallback |
| `<Suspense fallback={...}>` | 异步组件加载期间显示 fallback |
| `<Teleport to="#target">` | children 渲染到指定容器（支持 `to` 切换迁移） |
| `<Transition name="fade" duration={300}>` | 单子节点进入/离开过渡类（`v-enter/leave-*`） |
| `<component is={Comp}>` | 动态组件 |

### 组件特性

| 能力 | 说明 |
|---|---|
| 插槽 | 默认（children 透传）/ 作用域（函数 children）/ 具名（`<template slot="name">`） |
| 动态组件 | `<component is>` + `resolveDynamicVNode` |
| 异步组件 | `lazy(() => import(...))`（配合 Suspense） |
| 模板引用 | `props.ref`（函数或 `{value}`）指向 DOM/组件实例，卸载置 null |
| attribute fallthrough | 白名单 attrs（class/className/style/id/on* 事件）自动落到单根元素，class/style 合并 |
| props 泛型推导 | `ComponentType<P>` / `PropsOf<T>`，JSX 组件 props 类型检查 |

---

## 三、渲染与更新（renderer）

### JSX

| API | 说明 |
|---|---|
| `jsx` / `jsxs` / `jsxDEV` | JSX 工厂（tsconfig `jsxImportSource: "@actview/jsx"`） |
| `Fragment` / `<>...</>` | 片段（多根） |
| `createElement(type, props, ...children)` | 经典写法 |
| `isValidElement(v)` | VNode 校验 |
| 事件 | `onClick` / `onclick` / `onXxxCapture`（invoker 缓存，更新不重绑） |

### DIFF 与更新

| 能力 | 说明 |
|---|---|
| keyed diff | 带 key 列表走 LIS 最小移动（`getSequence`），支持 Fragment 根组件 |
| 同索引 diff | 无 key 列表逐位 patch（含文本节点 el 持久化定位） |
| props 细粒度更新 | `patchProps` / `setProp`（class/style/value/checked/事件/属性） |
| 受控 input 光标保位 | 更新 value 前后记录/恢复 `selectionStart/End` |
| 调度批处理 | `queueJob` 微任务去重 + `nextTick(cb?)` |

### 构建期 / SSR

| API | 说明 |
|---|---|
| `renderToString(vnode)` | VNode → HTML 静态序列化（Node 端可用；组件走 `__setup` + render，钩子不执行） |

---

## 四、路由（@actview/router）

| API | 说明 |
|---|---|
| `createRouter({ history, routes })` | 创建路由实例（`router.push(path)`） |
| `createWebHistory(base?)` / `createMemoryHistory()` | history 模式 |
| `<RouterLink to="...">` / `<RouterView />` | 链接 / 路由出口 |
| `currentRouter` | 当前路由实例 |
| 类型 | `Router` / `RouteLocation` / `RouteRecord` / `RouteLocationRaw` / `MatchedRoute` |

```tsx
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomePage },
    { path: '/about', component: AboutPage },
  ],
})
```

> 现阶段：路由切换 =》 组件切换（无守卫/懒加载等能力，见 PLAN.md）。

---

## 五、工程化（@actview/plugin）

| 能力 | 说明 |
|---|---|
| `actviewPlugin()`（Vite 插件） | `.tsx` 先过 Babel 做 defineComponent 转换（含 JSX 已降级为 `_jsx()` 调用的兼容） |
| `defineComponentPlugin`（Babel 插件） | 组件函数 → `defineComponent`；具名插槽 `<template slot>` 编译期提取 |

---

## 六、能力对照速查（Vue 3 风格）

| 能力 | 状态 |
|---|---|
| reactive / ref / computed / watch / watchEffect | ✅ |
| 数组响应 / for-in 响应 / markRaw / readonly / shallowReactive | ✅ |
| 生命周期四件套 + EffectScope 自动停止 | ✅ |
| keyed diff / props 更新 / 批处理 / nextTick | ✅ |
| 插槽（默认/作用域/具名）/ 动态组件 / KeepAlive | ✅ |
| ErrorBoundary / Suspense / lazy / ref 模板引用 | ✅ |
| Teleport / Transition / renderToString | ✅ |
| attribute fallthrough（白名单透传） | ✅（阶段 1） |
| 路由（组件切换） | ✅（守卫/懒加载待规划） |
| defineComponent options 形态 `{ props, setup(props, ctx) }` / `$attrs` / `inheritAttrs` | 📋 待办（PLAN.md 阶段三 12） |
| SVG 命名空间渲染 / `dangerouslySetInnerHTML` | 📋 待办 |
