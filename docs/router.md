# 路由实现原理（@actview/router）

> 源码：`packages/router/src/`（`matcher.ts`、`router.ts`、`history.ts`、`components.tsx`）
> 仿 Vue Router 最小版，但保持 React Router 的 TSX 组件形态。

---

## 1. 总览

```
createRouter({ history, routes })
  ├─ matcher：path → MatchedRoute[]（根到叶子的匹配链）
  ├─ currentRoute：reactive 状态（RouterView 渲染时读取 → 路由变化触发组件切换）
  ├─ history：location 来源 + 导航事件（web/memory）
  └─ 守卫：beforeEach / afterEach / beforeEnter
```

核心思想：**路由状态是 `reactive`，RouterView 是读它的普通组件**——路由变化 → `currentRoute` 更新 → RouterView 的 render effect 重跑 → 组件切换（patch replace）。

---

## 2. matcher（路径匹配）

### 2.1 前缀 + 段边界正则

嵌套路由的父级需要「前缀命中」，不能用完整锚定：

```ts
// /user/:id 编译为前缀正则（lookahead 段边界）
^\/user\/([^/]+)(?=\/|$)
```

- `(?=\/|$)`：匹配到段边界（后接 `/` 或结束），避免 `/user/1` 误匹配 `/user/10`
- 动态段 `:param` → `([^/]+)`，静态段字面量

### 2.2 递归匹配（返回匹配链）

```
matchPath(records, targetPath, baseParams):
  对每个 record：prefixRegex.exec(targetPath) 命中？
    → 提取 params（合并父 params）
    → 有 children：递归匹配（完整 targetPath），命中则 concat
        子均未命中且剩余为空 → 父作为叶子
    → 无 children：剩余必须为空（否则不匹配）
```

`match` 返回 `MatchedRoute[]`（根到叶子），叶子 params 聚合了整条链的动态段。

### 2.3 路由记录

```ts
interface RouteRecord {
  path: string
  component?: any              // 组件 或 () => import() 懒加载
  name?: string
  redirect?: string | { path }
  meta?: Record<string, any>
  beforeEnter?: NavigationGuard  // 路由级守卫
  children?: RouteRecord[]
}
```

`normalize` 时 `markRaw(record)`：路由记录不参与响应式代理（避免 `component` 对象被包 Proxy）。

---

## 3. router（导航状态 + 守卫）

### 3.1 currentRoute 响应式状态

```ts
const currentRoute = reactive<RouteLocation>({
  path: '/', query: {}, params: {}, fullPath: '/', matched: []
})
```

`matched` 存匹配链数组，RouterView 按深度索引取组件。

### 3.2 导航流程（navigate）

```
navigate(fullPath):
  to = buildLocation(fullPath)      // 解析 + 匹配链
  from = {...currentRoute 快照}
  leaf.redirect? → 重定向到 target
  guards = [...beforeGuards, ...matched 各 record.beforeEnter]
  无守卫 → 同步 applyLocation + afterEach
  有守卫 → runGuards（串行 await）→ false 取消 / 重定向 / applyLocation
```

- **无守卫同步**：`push` 后 `currentRoute` 立即更新（渲染经 scheduler 异步，`nextTick` 后可见）
- **有守卫异步**：`runGuards` 串行执行，返回 `false` 取消、返回 `{path}` 重定向
- 守卫签名：`(to, from) => void | boolean | string | { path } | Promise`

### 3.3 守卫 API

```ts
router.beforeEach(guard)   // 全局前置，返回取消函数
router.afterEach(hook)     // 全局后置
// 路由级：RouteRecord.beforeEnter
```

---

## 4. RouterView / RouterLink

### 4.1 RouterView 嵌套（provide/inject 传递深度）

```ts
const ROUTER_VIEW_DEPTH = 'routerViewDepth'

RouterView = defineComponent(function (_props, ctx) {
  const depth = ((ctx?.injects?.[ROUTER_VIEW_DEPTH] ?? -1) + 1)
  provide(ROUTER_VIEW_DEPTH, depth)   // 给子组件
  return () => {
    const matched = currentRouter.currentRoute.matched
    if (depth >= matched.length) return null
    const record = matched[depth].record
    return jsx(resolveComponent(record.component), { path, params, query })
  }
})
```

- 顶层 RouterView `depth=0` 渲染 `matched[0]`，嵌套 RouterView `depth=1` 渲染 `matched[1]`
- 深度经组件实例 `injects` 链传递（`provide` 后子组件 `injects` 继承）

### 4.2 懒加载（lazy 缓存）

```ts
const lazyCache = new Map<any, any>()
function resolveComponent(component) {
  if (typeof component !== 'function') return component
  if (!lazyCache.has(component)) lazyCache.set(component, lazy(component))
  return lazyCache.get(component)
}
```

- `component: () => import()` 是函数 → 用 `lazy()` 包装 + **缓存**（同一个 loader 只建一次 lazy 实例，避免反复触发 Suspense 卸载重挂死循环）
- 配合 `<Suspense>` 显示 fallback

### 4.3 RouterLink

渲染 `<a>`，`onclick` 里 `preventDefault` + `router.push(to)`。

---

## 5. history（web / memory）

| 模式 | 机制 |
|---|---|
| `createWebHistory` | `history.pushState` + `popstate`；`push`/`replace` 手动 notify（pushState 不触发 popstate） |
| `createMemoryHistory` | 内存栈 `stack[] + index`，`push`/`replace`/`go` 直接改 index + emit |

统一接口：`location`（当前路径）、`listen(cb)`、`push`/`replace`/`go`。

---

## 6. 设计取舍

| 项 | 决策 |
|---|---|
| 守卫返回值 | `false` 取消 / `{path}` 重定向 / Promise 异步（简化 Vue Router 的 `next()` 回调） |
| 重定向 | `navigate` 递归导航，不更新 history 栈（简化） |
| hash history | 未实现（只有 web/memory） |
| 命名视图 / scrollBehavior | 未实现 |
