# SSR / Hydration

> 使用 API 见 [packages/server/README.md](../packages/server/README.md)。
> 本文记录实现分层、请求流程与当前边界。

## 1. 分层

```text
@actview/core
  ├─ 组件实例 / setup / renderComponentRoot
  ├─ DOM renderer（createApp.mount）
  ├─ hydrate renderer mode（复用已有 DOM）
  └─ server-internal（仅 @actview/server 使用）

@actview/server
  ├─ createSSRApp
  ├─ renderToString / renderToHTML
  ├─ useSSRContext（head / state）
  └─ hydrate / resolveHydrationContainer
```

`core` 不依赖 `server`；`server` 通过 `core/server-internal` 复用组件 setup / render 逻辑。

## 2. 服务端请求流程

```text
HTTP request
→ createSSRApp(App, props)
→ app.use(router / plugins)
→ 可选 await router.push(url)
→ renderToString / renderToHTML
   ├─ createComponentInstance
   ├─ setupComponent（async setup 会 await）
   ├─ renderComponentRoot
   ├─ 递归序列化 VNode
   └─ 停止组件 EffectScope
→ HTML + head + state
```

每个请求使用新的 `SSRApp`；`app` 级 Model scope 属于该 AppContext。

## 3. 客户端 Hydration 流程

```text
浏览器已有 SSR HTML
→ createSSRApp(App, props)
→ app.use(router / plugins)
→ app.hydrate('#app')
   ├─ 按游标匹配已有元素 / 文本
   ├─ patchProps：绑定事件 / class / style
   ├─ 建立组件 render effect / refs
   └─ 后续更新走 scheduler → patch
```

相邻文本 VNode 在 `normalizeChildren` 中合并，避免 SSR 一个 text node 与客户端多个 VNode 对不齐。

## 4. Phase 能力

| Phase | 内容 | 状态 |
|---|---|---|
| 1 | `renderToString`、元素 / 文本 / Fragment / props、Model / provide-inject、每请求 App | ✅ |
| 2 | async setup、lazy、Suspense、ErrorBoundary、KeepAlive / Transition / Teleport 内容 | ✅ |
| 3 | hydrate、DOM 复用、事件 / refs、基础 mismatch 替换恢复 | ✅ 基础 |
| 4 | Router SSR、route loader 数据预取、head / state、renderDocument（CSS/client entry）、renderToStream、SSR App 清理、测试 | ✅ 基础 |

## 5. 当前边界

- Hydration 边界标记未实现：Teleport / Suspense 的客户端 takeover 仍不完整；KeepAlive 基础子树可 hydrate；
- mismatch 支持基础替换 + 多余子节点移除，不是完整恢复策略；
- `renderToStream` 已支持按 VNode 边界流式输出；不支持 streaming hydration / out-of-order；
- head 是字符串收集，由 `renderDocument` 拼装；不自动注入复杂 head 管理；
- CSS 通过 `renderDocument({ css })` 输出 link，由宿主构建链处理；
- SSR 结束会触发 app 级 Model hooks 与 `app.onUnmount`；每个 SSRApp 只渲染一次；
- `useSSRContext` 只在组件 `@Setup` 阶段有效。

## 6. 测试

- `packages/server/__tests__/ssr.spec.tsx`：同步 / 异步 / builtins / head-state；
- `packages/server/__tests__/hydration.spec.tsx`：DOM 复用 / 事件 / unmount；
- `packages/server/__tests__/ssr-router.spec.tsx`：Router SSR / guard / router hydrate。

当前全仓：`pnpm test` **457 passed / 4 skipped**。
