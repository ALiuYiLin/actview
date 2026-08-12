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

本仓库（[ActView](https://github.com/ALiuYiLin/actview)）同时是 ActView 的开发与验证仓库：

```bash
pnpm install
pnpm dev        # 演示页（覆盖全部能力）
pnpm test       # 回归测试（vitest + happy-dom）
```

## 性能基准（js-framework-benchmark）

ActView 已加入 [js-framework-benchmark](https://github.com/krausest/js-framework-benchmark)（keyed 模式），实现位于 [`frameworks/keyed/actview`](https://github.com/ALiuYiLin/js-framework-benchmark/tree/master/frameworks/keyed/actview)。

以下为本地实测数据（Chrome + puppeteer 驱动，5 次迭代取均值，单位 ms），**非官方结果**，仅供参考；官方结果以 [results page](https://krausest.github.io/js-framework-benchmark/index.html) 为准。

> 本次数据对应框架当前实现：P0 运行时短路（patchProps 值比较 / props 引用 / children 引用短路）+ v-memo 指令（行级显式依赖短路）。

### CPU 基准（total 均值）

| 基准 | vanilla | vue | react-hooks | svelte | solid | preact-hooks | **actview** |
|---|---|---|---|---|---|---|---|
| 创建 1000 行 | 38.5 | 48.4 | 48.2 | 40.6 | 40.2 | 49.0 | **52.1** |
| 替换 1000 行 | 41.0 | 51.2 | 54.8 | 44.6 | 44.5 | 53.9 | **55.4** |
| 局部更新（每第 10 行） | 20.8 | 23.9 | 29.0 | 23.0 | 21.5 | 42.1 | **33.0** |
| 选中行高亮 | 7.5 | 8.6 | 11.1 | 12.0 | 8.8 | 27.0 | **20.8** |
| 交换两行 | 22.7 | 26.5 | 205.8 | 25.4 | 24.0 | 42.0 | **32.7** |
| 删除一行 | 17.9 | 23.2 | 20.4 | 20.1 | 19.0 | 28.1 | **25.1** |
| 创建 10000 行 | 416.9 | 526.3 | 738.9 | 450.3 | 446.8 | 556.3 | **584.8** |
| 大表追加 1000 行 | 42.8 | 51.4 | 54.3 | 44.5 | 44.2 | 55.5 | **58.2** |
| 清空 10000 行 | 15.5 | 23.5 | 31.3 | 19.2 | 21.3 | 24.0 | **24.1** |

### 内存 / 体积 / 首屏

| 基准 | vanilla | vue | react-hooks | svelte | solid | preact-hooks | **actview** |
|---|---|---|---|---|---|---|---|
| ready memory（MB） | 0.58 | 0.86 | 1.17 | 0.62 | 0.61 | 0.65 | **0.67** |
| run memory（MB） | 2.05 | 4.08 | 4.57 | 2.98 | 2.85 | 3.49 | **4.31** |
| 创建/清空 5 轮（MB） | 0.67 | 1.20 | 1.96 | 0.93 | 0.75 | 0.83 | **1.20** |
| 未压缩体积（kB） | 11.7 | 64.4 | 190.3 | 26.6 | 11.5 | 14.7 | **19.6** |
| gzip 体积（kB） | 2.5 | 23.3 | 51.4 | 9.7 | 4.5 | 5.7 | **6.5** |
| 首屏绘制（ms） | 335.8 | 332.1 | 343.3 | 334.4 | 328.3 | 354.0 | **333.0** |

### 复现

```bash
git clone https://github.com/ALiuYiLin/js-framework-benchmark
cd js-framework-benchmark
npm ci && npm run install-local
npm start   # 后台常驻：http://localhost:8080
cd frameworks/keyed/actview && npm ci && npm run build-prod
cd ../.. && node webdriver-ts/dist/benchmarkRunner.js keyed/actview
cd webdriver-ts && npm run results   # 结果表：http://localhost:8080/webdriver-ts-results/dist/index.html
```

## License

MIT
