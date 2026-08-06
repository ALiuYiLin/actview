# ActView

> 自研响应式前端框架（Vue 3 风格）——组件 =》 虚拟 DOM =》 DIFF =》 真实 DOM，附带完整生态（JSX 工厂 / Babel 插件 / 路由）。

本仓库是 ActView 的开发与验证仓库（`JSX-Demo`）：源码在 `packages/`，演示页在 `src/`，回归测试在 `scripts/verify.test.tsx`。

## 特性

- **响应式系统**：`reactive` / `ref` / `computed` / `watch` / `watchEffect` / `toRefs` / `readonly` / `markRaw` / `shallowReactive`
  - 数组方法 instrumentation（`push/pop/splice...` 触发更新）、`for...in` / `'in'` 响应、`ITERATE_KEY`、`pauseTracking`（effect 内修改自身依赖不爆栈）
- **渲染器**：VNode → DOM，keyed diff（LIS 最小移动）、props 细粒度更新、同索引 diff、Fragment、文本 vnode 持久化
- **组件能力**：生命周期钩子（`onMounted` / `onUpdated` / `onBeforeUnmount` / `onUnmounted`）、`defineComponent`、插槽（默认/作用域/具名）、动态组件 `<component is>`、`KeepAlive`、`ErrorBoundary`、`Suspense` + `lazy`、`props.ref` 模板引用、attribute fallthrough（白名单透传）
- **调度批处理**：`queueJob` 微任务去重 + `nextTick`
- **内置组件**：`Teleport`（DOM 传送）、`Transition`（进入/离开过渡）、`renderToString`（构建期 VNode→HTML 静态序列化）
- **JSX 支持**：`@actview/jsx` 工厂 + `@actview/plugin`（Babel 插件把组件函数转 `defineComponent`，支持 JSX 类型推导与 camelCase 事件）

## 包结构（pnpm monorepo）

| 包 | 说明 |
|---|---|
| `@actview/jsx` | JSX 工厂（`jsx` / `jsxs` / `jsxDEV` / `Fragment` / 类型定义） |
| `@actview/core` | 响应式 + 渲染器 + 组件运行时（框架核心） |
| `@actview/router` | 路由（createRouter / createWebHistory / RouterLink / RouterView） |
| `@actview/plugin` | Vite + Babel 插件（defineComponent 转换） |
| `actview` | 聚合入口（`import { createApp, reactive } from 'actview'`） |

## 快速开始

```bash
pnpm install
pnpm dev        # 启动演示页（vite，含全部能力检验页）
```

```tsx
// tsconfig.json: "jsx": "preserve", "jsxImportSource": "@actview/jsx"
import { createApp, reactive } from 'actview'
import { RouterLink, RouterView, createRouter, createWebHistory } from '@actview/router'

function App() {
  const state = reactive({ count: 1 })
  return (
    <div>
      <span>hello: {state.count}</span>
      <button onclick={() => state.count++}>+1</button>
    </div>
  )
}

createApp(App).mount('#app')
```

## 开发命令

| 命令 | 说明 |
|---|---|
| `pnpm test` | 回归测试（vitest + happy-dom，`scripts/verify.test.tsx`，120+ 用例） |
| `npx tsc --noEmit` | 类型检查 |
| `npx vite build` | 演示页构建 |
| `pnpm build`（各包内） | tsup 打包 + `scripts/rewrite-package.mjs` 生成 `dist/package.json` |
| `npm run release` | 检测版本变化并按依赖顺序发布到 npm |
| `npm run patch:<包名>` | 手动 bump 版本（`patch:core` / `patch:router` / ...） |

## 文档

- [`docs/DESIGN.md`](docs/DESIGN.md) — 架构设计：响应式与 JSX 如何连接、组件 → VDOM → DIFF → 真实 DOM、更新过程
- [`docs/PLAN.md`](docs/PLAN.md) — 路线图与完成记录
- [`docs/attr-fallthrough.md`](docs/attr-fallthrough.md) — attribute fallthrough 设计方案（阶段 1 已实现）
- [`docs/bugs.md`](docs/bugs.md) — 已修复 / 已知限制清单
- [`docs/test.md`](docs/test.md) — 测试场景说明

## 发布

发布到 npm（`@actview/*` 与 `actview`），需要 `NPM_TOKEN` 环境变量（或 `npm login`）：

```powershell
$env:NPM_TOKEN="npm_你的token"   # 或 setx NPM_TOKEN "npm_你的token" 持久化
npm run patch:core                # 需要发哪个包就 patch 哪个
npm run release                   # 自动按依赖顺序构建并发布版本变化的包
```

## License

MIT
