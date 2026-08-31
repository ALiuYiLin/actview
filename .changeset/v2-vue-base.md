---
'actview': major
'@actview/plugin-jsx': minor
---

ActView v2：Vue 引擎 + React 语义 JSX（架构转向）

- **运行时基于 vue 官方包**：reactivity / patch / diff / 内置组件 / SSR 全部
  复用 vue（依赖 `vue ^3.5.0`），v1 自研 core 冻结归档（见
  docs/architecture-v2-vue-base.md）。
- **新包 @actview/plugin-jsx**（fork @vue/babel-plugin-jsx v3.0.0）：
  JSX 编译产物直出 `createVNode`，与 Vue 模板产物运行时同构；React 对齐映射：
  `className`→`class`、`htmlFor`→`for`、`onChange`→`onInput`（text-like
  input/textarea）、`dangerouslySetInnerHTML`→`innerHTML`；组件 props 不映射。
- **defineComponent 桥接**（React 语义）：Proxy 桥接 `ctx.slots` →
  `props.children`（读时求值 slots.default()），props 读不到从 attrs 兜底，
  `inheritAttrs: false`；`createContext` 基于 vue provide/inject。
- **测试**：v1 测试（593 用例）import 固定到 `@actview/core` 保持冻结语义；
  新增 test/v2 冒烟 5 用例（className 映射 / children 桥接 / onChange→onInput /
  createContext / v-model）。全量 598 用例通过。
