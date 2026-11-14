# @actview/server

ActView 的 SSR / hydration 入口（workspace 包，暂不发布）。

## API

```ts
import {
  createSSRApp,
  renderToString,
  renderToHTML,
  useSSRContext,
  hydrate,
} from '@actview/server'
```

- `createSSRApp(root, props?)`：创建带 `renderToString()` / `renderToHTML()` / `hydrate()` 的 App；
- `renderToString(app, props?)`：同步 / 异步组件树 → HTML 字符串（不等待客户端生命周期）；
- `renderToHTML(app, props?)`：返回 `{ html, head, state }`；
- `useSSRContext()`：在 `@Setup` 中收集 head / 初始 state；客户端返回 null；
- `hydrate(app, container, props?)`：在已有 SSR HTML 上 hydration。

## 服务端

```tsx
import { createSSRApp } from '@actview/server'
import { createMemoryHistory, createRouter } from '@actview/router'

const router = createRouter({
  history: createMemoryHistory(req.url),
  routes,
})

const app = createSSRApp(App)
app.use(router)

const { html, head, state } = await app.renderToHTML()

res.end(`<!doctype html>
<html>
  <head>${head}</head>
  <body>
    <div id="app">${html}</div>
    <script>window.__ACTVIEW_STATE__ = ${JSON.stringify(state)}</script>
    <script type="module" src="/client.js"></script>
  </body>
</html>`)
```

每个请求使用**新的 SSRApp**；不要跨请求复用 App / Model 实例。

## head 与初始 state

```tsx
@Component
class App extends ActViewComponent {
  @Setup
  setup(): void {
    const ctx = useSSRContext()
    ctx?.head.push('<title>My App</title>')
    if (ctx) ctx.state.user = { name: 'Ada' }
  }

  render() {
    return <main>...</main>
  }
}
```

`renderToHTML()` 返回：

```ts
{
  html: '<main>...</main>',
  head: '<title>My App</title>',
  state: { user: { name: 'Ada' } }
}
```

## 客户端 hydration

```tsx
import { createSSRApp } from '@actview/server'

const app = createSSRApp(App, props)
app.use(router)
app.hydrate('#app')
```

要求：

- 服务端 / 客户端组件树一致；
- 根 props 一致；
- 服务端 location 与客户端初始 location 一致（router 通常用 memory history + 客户端 URL）；
- hydration 会复用元素 / 文本节点、绑定事件 / refs，并建立 render effect。

## 异步 SSR

支持：

- async `@Setup`；
- `lazy()` 组件（服务端直接加载最终组件）；
- `Suspense`（服务端等待子树，不输出 fallback）；
- `ErrorBoundary`（服务端捕获子树错误并输出 fallback）；
- `KeepAlive` / `Transition` / `Teleport` 内容直接输出。

## Router SSR

```tsx
const router = createRouter({
  history: createMemoryHistory(req.url),
  routes: [...],
})

const app = createSSRApp(App)
app.use(router)

// 需要 guards / 重定向 / 数据预取时，先 push：
await router.push(req.url)

const html = await app.renderToString()
```

## 当前边界

- Hydration 已支持元素 / 文本 / Fragment / 普通组件 / router；
- Teleport / KeepAlive / Suspense 的 hydration 边界标记尚未完整实现；
- 没有 streaming SSR；
- head 目前是字符串收集，不是自动注入模板；
- CSS 由宿主构建链处理（例如 Vite / Tailwind），不在 SSR 包内；
- `app.onUnmount` 在 SSR 请求结束时的插件清理尚未自动调用；
- 生产使用前需要补：hydration mismatch 恢复、app 级 scope 清理、流式渲染、SSR 测试矩阵。
