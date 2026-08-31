# actview

**ActView v2 — Vue 引擎 + React 语义 JSX**

运行时基于 `vue` 官方包（零自研）：响应式 / 调度 / patch / diff / 内置组件 / SSR 全部复用。JSX 语法层面对齐 React：`className` / `htmlFor` / `onChange` 语义、`{}` 表达式、受控组件、`props.children` 直读。

## 核心功能

- **vue 运行时 re-export**：响应式（`ref` / `reactive` / `computed` / `watch` / `effectScope`）、组件（`defineComponent` / `createApp` / `h`）、生命周期、内置组件（`KeepAlive` / `Teleport` / `Suspense` / `Transition` / `TransitionGroup`）
- **defineComponent 桥接**（React 对齐）：props 读不到时从 attrs 兜底（React 风格任意 props 可读）；**`props.children` 渲染期读取 = 子内容值**（React 语义，非渲染期读取返回 undefined 并提示——判断有无子内容用 `props.slots.default != null`）；`props.slots.default()` 具名插槽/显式调用（render 期）；**createVNode 包装**：`<p {...props}>` 展开的 children 键自动抽进第三参（React 对齐）；桥接虚拟键（children/slots）不参与展开/遍历；**有 props 声明时自动落根**（`inheritAttrs` 开启，未消费 attrs 透传到根元素 + scoped data-v 生效），无声明时保持不透传（React 语义，避免 props 污染 DOM）
- **createContext**：React 语义（`.Provider` / `.use()`），基于 vue `provide/inject`
- **JSX 类型层**：全局 `IntrinsicElements` 完整标签表（React 语义属性）+ vue 组件兼容；组件 props 严格检查（未声明 prop 报错）

## 安装

```bash
pnpm add actview vue
pnpm add -D @actview/plugin-vite
```

`vite.config.ts`：

```ts
import { defineConfig } from 'vite'
import { actviewJsxPlugin } from '@actview/plugin-vite'

export default defineConfig({
  plugins: [actviewJsxPlugin()],
})
```

`tsconfig.json`：

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "actview"
  }
}
```

## 快速开始

```tsx
import { createApp, ref } from 'actview'

// 函数组件：编译期自动包 defineComponent（React 函数组件语义）
function App() {
  const count = ref(0)
  return () => (
    <button className="c" onClick={() => count.value++}>
      {count.value}
    </button>
  )
}

createApp(App).mount('#app')
```

JSX 由 `@actview/plugin-jsx` 编译（Babel 直出 `createVNode`）：
- `className` → `class`、`htmlFor` → `for`、`onChange` → `onInput`（text-like input/textarea）
- `dangerouslySetInnerHTML={{ __html }}` → `innerHTML`
- `v-model` / `v-show` 等 Vue 指令属性可直接使用
- `props.children` 桥接：组件内直接读 `props.children`（React 语义）

## 生态复用（不重复造轮子）

| 需求 | 方案 |
|---|---|
| 路由 | `vue-router` |
| 状态管理 | `pinia` |
| 测试 | `@testing-library/vue` |
| devtools | vue devtools（浏览器插件） |
| hooks | vue 原语（`ref` / `computed` / `watch` 内联组合） |

## API（re-export 自 vue）

| 分组 | 导出 |
|---|---|
| 应用 | `createApp` |
| 组件 | `defineComponent`（桥接版）/ `h` / `createVNode` / `mergeProps` / `defineAsyncComponent` |
| 响应式 | `ref` / `reactive` / `computed` / `watch` / `watchEffect` / `customRef` / `proxyRefs` / `effectScope` / `nextTick` |
| 生命周期 | `onMounted` / `onUpdated` / `onBeforeUnmount` / `onUnmounted` / `onErrorCaptured` / `onServerPrefetch` |
| 依赖注入 | `provide` / `inject` / `createContext` |
| 内置组件 | `KeepAlive` / `Teleport` / `Suspense` / `Transition` / `TransitionGroup` / `Fragment` / `Text` |
| 其他 | `useId` / `useTemplateRef` / `useAttrs` / `useSlots` / `version` |

## License

MIT
