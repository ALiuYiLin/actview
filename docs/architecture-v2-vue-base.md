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

| 包 | 内容 |
|---|---|
| `@actview/plugin-jsx` | fork @vue/babel-plugin-jsx + §3 映射（新） |
| `actview` | 依赖 vue + re-export + defineComponent 桥接（改造） |
| `@actview/hooks-react` | 基于 vue reactivity 封装 React hooks 风格 API（v2 重写） |
| `@actview/router` / `@actview/store` / `@actview/testing` / `@actview/devtools` | 基于 vue 基座（后续迁移） |
| `packages/core` 等 v1 包 | 冻结归档 |

## 6. 迁移路径

1. ✅ 决策：冻结 core、vue 基座、运行时桥接
2. plugin-jsx fork + 映射改造（本轮）
3. actview 包 vue 化 + 桥接（本轮）
4. 冒烟测试：React 风格组件编译+运行（本轮）
5. hooks-react / testing / router / store 迁移（后续轮）
6. base-ui / floating-ui 移植决策（后续轮）
