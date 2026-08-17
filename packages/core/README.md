# @actview/core

**ActView 框架内核** —— 响应式系统 + DOM 渲染器 + 组件运行时，零依赖。

`@actview/core` 承载框架的全部运行时能力：响应式（`ref`/`reactive`/`computed`/`watch`/`EffectScope`）、VNode → DOM 渲染器（patch 算法）、组件体系（`defineComponent`/`createApp`）、生命周期与内置组件（`Transition`/`KeepAlive`/`ErrorBoundary`/`Suspense`/`Teleport`）、SSR 序列化（`renderToString`）。

## 核心功能

- **响应式系统**：`reactive`/`ref`/`computed`/`watch`/`effectScope` + 微任务调度批处理（`queueJob`/`nextTick`）
- **渲染器**：VNode 树 → 真实 DOM（挂载/更新/卸载、keyed diff、事件与属性 patch）
- **组件体系**：`defineComponent`、`createApp`、props 全量进 setup（React 语义，用户显式 `{...props}` 透传）
- **生命周期与组合式 API**：`onMounted`/`onUpdated`/`onBeforeUnmount`/`onUnmounted`、`provide`/`useInjects`、`getCurrentScope`
- **内置组件**：`Transition`、`KeepAlive`、`ErrorBoundary`、`Suspense`、`Teleport`、`lazy`
- **SSR**：`renderToString`（VNode → HTML 字符串，构建期/SSR 前置，无 DOM 依赖）

## 安装

```bash
pnpm add @actview/core
```

## 快速开始

```tsx
import { createApp, reactive, defineComponent } from '@actview/core'

function App(props: { title: string }) {
  const state = reactive({ count: 0 })
  return (
    <div onClick={() => state.count++}>
      {props.title}: {state.count}
    </div>
  )
}

createApp(<App title="hello" />).mount('#app')
```

## API

### 响应式

| 导出 | 说明 |
|---|---|
| `reactive` / `shallowReactive` / `readonly` / `markRaw` | 对象响应式代理 |
| `ref` / `isRef` / `unref` / `toRef` / `toRefs` | ref 相关 |
| `computed` | 计算属性（类型：`ComputedRef`/`WritableComputedRef`/`ComputedOptions`） |
| `watch` / `watchEffect` | 侦听器 |
| `EffectScope` / `getCurrentScope` | 作用域批量管理 effect 生命周期 |
| `nextTick` | 等待本轮调度 flush 完成 |

> 内部引擎（`ReactiveEffect`、`track`/`trigger`、`queueJob`、`runEffect`、`pauseTracking` 等）由 `reactivity/` 导出，属实现细节，一般不需要直接使用。

### 组件 / 渲染

| 导出 | 说明 |
|---|---|
| `createApp` | 应用入口（`app.mount`） |
| `defineComponent` | 组件定义包装器（产物 `{ __setup }`，props 全量进 setup） |
| `onMounted` / `onUpdated` / `onBeforeUnmount` / `onUnmounted` | 生命周期钩子 |
| `provide` / `useInjects` | 依赖注入 |
| `Transition` / `KeepAlive` / `ErrorBoundary` / `Suspense` / `Teleport` / `lazy` | 内置组件 |
| `renderToString` | VNode → HTML 字符串 |
| 类型：`App` / `SetupContext` / `ComponentOptions` / `ComponentInstance` / `VNode` | 常用类型 |

## 内部结构

```
src/
  reactivity/    响应式引擎（reactive-system/effectScope）+ 公开 API（ref/reactive/computed/watch）
  runtime/       渲染与组件运行时（renderer/mountComponent/lifecycle/component/内置组件/renderToString）
  vnode.ts       core 自持的 VNode 类型体系（与 @actview/jsx 结构兼容）
```

依赖方向：`reactivity ← runtime`（单向），`runtime/` 内无模块环。

## 依赖关系

- **运行时依赖**：无（零依赖；VNode 类型自持，不依赖 `@actview/jsx`）
- **被依赖方**：`actview` 聚合包、`@actview/router`

## 开发

```bash
pnpm build   # tsup 打包 dist
pnpm test    # 走根目录 vitest（test/** 集成测试，含 verify/scoped/acceptance 场景）
```

## License

MIT
