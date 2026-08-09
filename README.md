# ActView

**ActView** 是一个响应式前端开发框架，结合了 **Vue 的响应式系统**与 **JSX 扩展语法**：用 `reactive` / `ref` / `computed` 管理状态，用 JSX 描述界面，框架自动完成 组件 → 虚拟 DOM → DIFF → 真实 DOM 的渲染与更新。

## 核心特性

- ⚡ **响应式状态**：`reactive` / `ref` / `computed` / `watch` / `watchEffect`，数组方法、`for...in` 全部响应式
- 🧩 **JSX 编写组件**：类 React 的组件写法，搭配 Vue 风格的组合式 API
- 🔄 **高效更新**：虚拟 DOM + keyed diff（LIS 最小移动）+ 调度批处理（`nextTick`）
- 🛠 **完整组件能力**：生命周期钩子、插槽（默认/作用域/具名）、`KeepAlive`、动态组件、`ErrorBoundary`、`Suspense`、`Teleport`、`Transition`
- 🌐 **路由与生态**：官方路由 `@actview/router`、Vite/Babel 插件 `@actview/plugin-vite` + `@actview/babel-plugin-actview`、脚手架 `@actview/create-cli`
- 📄 **构建期能力**：`renderToString`（VNode → HTML 静态序列化）

## 快速开始

### 方式一：脚手架创建（推荐）

```bash
npm create @actview/cli@latest my-app
cd my-app
npm install
npm run dev
```

> 脚手架文档：[actview-cli/README.md](https://github.com/ALiuYiLin/actview-cli)

### 方式二：手动引入

```bash
npm install actview @actview/router @actview/jsx @actview/plugin-vite
```

配置 Vite + TypeScript 后：

```tsx
// tsconfig.json: "jsx": "preserve", "jsxImportSource": "@actview/jsx"
import { createApp, reactive } from 'actview'

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

## 示例

```tsx
import { createApp, ref, computed } from 'actview'

function Counter() {
  const count = ref(0)
  const double = computed(() => count.value * 2)
  return (
    <div>
      <p>count: {count.value}（double: {double.value}）</p>
      <button onclick={() => count.value++}>+1</button>
    </div>
  )
}

createApp(Counter).mount('#app')
```

## 文档

- **框架文档**：[ActView Docs](https://github.com/ALiuYiLin/actview-docs)（基于 ActPress 构建的官方文档站）
- **快速创建项目**：[actview-cli/README.md](https://github.com/ALiuYiLin/actview-cli)

## 包结构

| 包 | 说明 |
|---|---|
| `actview` | 统一入口（`createApp` / `reactive` / `ref` / ...） |
| `@actview/core` | 响应式 + 渲染器 + 组件运行时 |
| `@actview/jsx` | JSX 工厂与类型定义 |
| `@actview/router` | 路由 |
| `@actview/plugin-vite` | Vite 插件（defineComponent 转换接入） |

## 开发与贡献

本仓库（[JSX-Demo](https://github.com/ALiuYiLin/JSX-Demo)）同时是 ActView 的开发与验证仓库：

```bash
pnpm install
pnpm dev        # 演示页（覆盖全部能力）
pnpm test       # 回归测试（vitest + happy-dom）
```

## License

MIT
