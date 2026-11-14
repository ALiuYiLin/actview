# @actview/server

ActView 的 SSR / hydration 入口（workspace 包，暂不发布）。

## API

```ts
import {
  createSSRApp,
  renderToString,
  renderToHTML,
  renderToStream,
  renderDocument,
  useSSRContext,
  hydrate,
} from '@actview/server'
```

- `createSSRApp(root, props?)`：创建带 `renderToString()` / `renderToHTML()` / `hydrate()` 的 App；
- `renderToString(app, props?)`：同步 / 异步组件树 → HTML 字符串（不等待客户端生命周期）；
- `renderToHTML(app, props?)`：返回 `{ html, head, state }`；
- `renderToStream(app, props?)`：按 VNode 边界流式输出 HTML；
- `renderDocument(options)`：拼装完整 HTML（title / CSS / state / client entry）；
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

res.end(renderDocument({
  html,
  head,
  state,
  title: 'My App',
  css: '/app.css',
  clientEntry: '/client.js',
}))
```

`renderDocument` 会拼装 `<!doctype html>`、title、CSS link、初始 state 脚本与 client entry；state 会转义 `</script>` 等危险片段。

路由 `loader` 在 `router.push` / `replace` 时执行，SSR 可先 push 再渲染：

```ts
await router.push(req.url)
const { html } = await app.renderToHTML()
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

## 流式 SSR

```ts
const app = createSSRApp(App)
for await (const chunk of app.renderToStream()) {
  res.write(chunk)
}
res.end()
```

流式输出按 VNode 边界：先写父元素 opening tag，再等待异步子组件并继续写。

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
- mismatch 支持基础替换与多余子节点移除；
- Teleport / KeepAlive / Suspense 的 hydration 边界标记尚未完整实现；
- streaming 中 ErrorBoundary 若已输出部分内容，无法撤回；
- 没有 streaming hydration / out-of-order streaming；
- head 目前是字符串收集，不是自动注入模板；
- CSS 由宿主构建链处理（例如 Vite / Tailwind），不在 SSR 包内；
- SSR 结束会触发 app 级 Model hooks 与 `app.onUnmount`；每个 SSRApp 只渲染一次。
- 生产使用前需要补：完整 hydration mismatch 恢复、Teleport/KeepAlive/Suspense takeover、SSR 测试矩阵。
