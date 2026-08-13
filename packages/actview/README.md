# actview

**ActView 框架统一入口（聚合包）** —— 从 `actview` 一个包拿到全部核心 API。

`actview` 是面向使用者的聚合包：re-export `@actview/core` 的全部公开 API 与类型，`import { createApp, reactive } from 'actview'` 即可开始开发，无需分别安装/引用 `@actview/core`。

## 核心功能

- 统一 re-export `@actview/core` 的运行时 API（响应式、组件、生命周期、内置组件、SSR）
- 统一导出类型（`App` / `SetupContext` / `ComponentOptions`）

> 不含 `@actview/router`（路由是独立包，按需安装，对齐 Vue 生态中 vue-router 的模型）。

## 安装

```bash
pnpm add actview
```

## 快速开始

```tsx
import { createApp, reactive, defineComponent, onMounted } from 'actview'

const App = defineComponent({
  setup() {
    const state = reactive({ count: 0 })
    onMounted(() => console.log('mounted'))
    return () => <div onClick={() => state.count++}>{state.count}</div>
  },
})

createApp(<App />).mount('#app')
```

## API（re-export 自 @actview/core）

| 分组 | 导出 |
|---|---|
| 应用 | `createApp` |
| 组件 | `defineComponent` |
| 响应式 | `reactive` / `shallowReactive` / `readonly` / `markRaw` / `ref` / `isRef` / `unref` / `toRef` / `toRefs` / `computed` / `watch` / `watchEffect` / `nextTick` |
| 生命周期 | `onMounted` / `onUpdated` / `onBeforeUnmount` / `onUnmounted` |
| 依赖注入 | `provide` / `useInjects` |
| 内置组件 | `Teleport` / `Transition` / `KeepAlive` / `ErrorBoundary` / `Suspense` / `lazy` |
| SSR / 其他 | `renderToString` / `getCurrentScope` |
| 类型 | `App` / `SetupContext` / `ComponentOptions` |

## 依赖关系

- `@actview/core`（全部 API 来源）
- `@actview/jsx`（类型契约；实际使用时还需在 `tsconfig` 配 `jsxImportSource: "@actview/jsx"`）

## 开发

```bash
pnpm build   # tsup 打包 dist（薄壳，仅 re-export）
pnpm test    # 走根目录 vitest
```

## License

MIT
