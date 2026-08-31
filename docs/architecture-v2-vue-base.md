# ActView 架构 v2：Vue 基座 + React 语义 JSX

> 状态：2026 决策落地。v1（自研 core，P0-P3 系列）冻结归档，不再演进。

## 1. 定位

**ActView = Vue 引擎 + React 语义的 JSX 语法层**

- 运行时全部基于 `vue` 官方包：响应式系统（ref/reactive/computed/watch）、
  内置组件（KeepAlive/Teleport/Suspense/Transition）、patch/diff、调度器、
  hydration/SSR——**零自研，跟随 Vue 版本演进**。
- JSX 语法层面对齐 React：`className`/`htmlFor`/`onChange` 语义、
  `{}` 表达式、`&&`/`map` 条件与列表、受控组件、`props.children` 直读。
- 编译层 = 改造 @vue/babel-plugin-jsx（@actview/plugin-jsx）：
  Babel 直出 `createVNode` 调用，产物与 Vue 模板编译产物运行时同构。

## 2. 与 v1 的关系

| | v1（自研 core） | v2（vue 基座） |
|---|---|---|
| 运行时 | `packages/core`（自研，593 测试） | `vue` 官方包（re-export） |
| 组件模型 | setup 闭包返回 render | Vue setup 对象 + 桥接层 |
| JSX 编译 | esbuild automatic runtime + defineComponent 包装 | Babel 插件直出 createVNode |
| 维护 | 冻结归档（git 历史保留，研究参考） | 跟随 Vue 版本 |

**冻结边界**：`packages/core`、`packages/jsx`、`packages/testing` 的 v1 实现
不再新增功能；v1 测试保留作为回归参考，不随 v2 演进。

## 3. React 对齐契约（@actview/plugin-jsx 编译期映射）

| React 写法 | 编译产物 | 说明 |
|---|---|---|
| `className="x"` | `class: "x"` | Vue patchProp 不认识 className |
| `htmlFor="x"` | `for: "x"` | JSX 里 for 是保留字 |
| `<input onChange={f}>`（text-like） | `onInput: f` | React onChange = 原生 input 事件 |
| `<input type=checkbox/radio onChange>` | `onChange` 保留 | React 里本就是 change 事件 |
| `<select onChange>` | `onChange` 保留 | 同上 |
| `dangerouslySetInnerHTML={{__html: x}}` | `innerHTML: x` | Vue 原生支持 innerHTML |
| `style={{backgroundColor: ...}}` | 原样（camelCase） | Vue patchStyle 支持 camelCase |
| `key` / `ref` | 原样进 props | Vue createVNode 原生提取 |
| `defaultValue` / `defaultChecked` | **不支持**（编译期报错提示） | Vue 无非受控默认值等价物 |

**明确放弃**：React 合成事件（事件委托）。Vue 直接 addEventListener，
对齐委托层需要自研事件系统，违背「基于 vue」初衷。

## 4. 运行时桥接（actview 包的 defineComponent）

Vue 组件模型：children 是 `ctx.slots`（延迟函数），React 是 `props.children`（值）。

桥接：`defineComponent` 包装层用 Proxy 包住 props：

```ts
setup(props, ctx) {
  const bridge = new Proxy(props, {
    get(t, k) {
      if (k === 'children') return ctx.slots.default?.() ?? null
      if (k === 'slots') return ctx.slots            // 具名插槽兼容 v1
      return Reflect.get(t, k)
    },
    has(t, k) {
      return k === 'children' || k === 'slots' || Reflect.has(t, k)
    },
  })
  return setup(bridge, ctx)
}
```

- `props.children` 每次读取求值 `slots.default()`——与 React「每次 render
  重新创建 children」语义一致；props 是响应式同一对象，闭包捕获安全。
- `props.slots` 挂 ctx.slots 整体：v1 的具名插槽（`<template slot>` → slots prop）
  编译产物可直接在 v2 组件上工作（slots.header 是函数）。
- 事件：`onClick`/`onChange` 等直接在 props 上（Vue patchProp 原生处理）。

## 5. 包结构（v2 目标）

**生态全部复用 vue 官方/社区，不自研**：

| 需求 | 方案 | 说明 |
|---|---|---|
| 路由 | **vue-router**（官方） | composables 与模板无关，JSX 组件直接用 |
| 状态管理 | **pinia**（官方） | defineStore 返回 composable，setup 里调用 |
| 测试工具 | **@testing-library/vue** | React Testing Library 风格（render/screen/userEvent） |
| devtools | **vue devtools**（浏览器插件） | v2 组件就是 vue 组件，天然识别 |
| hooks | **vue 原语**（ref/computed/watch 内联组合） | 不封装 React hooks 风格 API |

**actview 自研的只有两件**：

| 包 | 内容 |
|---|---|
| `@actview/plugin-jsx` | React 语义 JSX 编译器（vue 生态没有：@vitejs/plugin-vue-jsx 是 vue 语义） |
| `actview` | vue re-export + defineComponent 桥接 + createContext + JSX 类型层 |

**v1 生态包（router/store/testing/hooks-react/devtools）已移除**——v1 的
core/jsx 保留冻结（v1 测试依赖，研究参考）。

## 6. 迁移路径

1. ✅ 决策：冻结 core、vue 基座、运行时桥接
2. ✅ plugin-jsx fork + 映射改造
3. ✅ actview 包 vue 化 + 桥接
4. ✅ 冒烟测试 + JSX 类型层
5. ✅ 移除 v1 生态包（router/store/testing/hooks-react/devtools），生态改用
   vue-router / pinia / @testing-library/vue / vue devtools
6. 编译体验层：plugin-jsx 自动 defineComponent 包装、@actview/plugin-vite v2 管线
7. src/ demo 区迁移 v2（改用 vue-router 等）
8. base-ui / floating-ui 移植决策
9. v1 冻结收尾（README/npm 标注）+ 发布（actview 2.0.0、@actview/plugin-jsx 0.x）
