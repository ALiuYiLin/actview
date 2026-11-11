# ActView 编译分层契约（L1 编译器 wrap / L2 宿主 automatic runtime）

> 本文档定义编译链路的边界：**`@actview/compiler` 只做 L1（组件函数 → `defineComponent(setup)`）；JSX 降级（L2）由宿主工具链的 automatic runtime 完成**，运行时实现是 `@actview/jsx`（`jsx` / `jsxs` / `Fragment`）。
>
> 这样 compiler 不需要重复实现 JSX 转换：esbuild / tsc / Babel 都有成熟、标准的 automatic runtime 支持，`tsconfig` 里的 `"jsx": "react-jsx"` + `"jsxImportSource": "@actview/jsx"` 已经把两者接上。

---

## 1. 分层总览

| 层 | 归属 | 输入 | 产物 | 职责 |
|---|---|---|---|---|
| **L1 wrap** | `@actview/compiler` | 含 JSX/TS 的模块（AST） | 组件定义点 = `defineComponent(setup)`；**JSX 原样保留** | 只认「声明位置 + PascalCase」；不读 JSX、不做 JSX 降级 |
| **L2 jsx** | 宿主工具链（esbuild / tsc / `@babel/plugin-transform-react-jsx`） | 含 JSX 的模块 | `jsx()` / `jsxs()` / `Fragment` 调用 | 标准 automatic runtime 语义；不认识 `defineComponent` |
| **runtime** | `@actview/jsx`（`./jsx-runtime`） | `jsx(type, props, key)` 调用 | VNode（`createElement` 产物） | 元素工厂 + 类型（`Element` / `ElementType` / JSX 命名空间） |
| **宿主** | Vite / esbuild | L1 产物 | 可执行 JS（JSX 降级 + TS 剥离） | `enforce: 'pre'` 让 L1 先跑，随后 esbuild 完成 L2 与类型剥离 |

**关键性质**：L1 不读 JSX ⇒ L1 的输入既可以是原始 TSX，也可以是宿主已经降级过的 JS（`jsx()` 调用）——两种输入产出相同形态的组件包装，**没有双路径、没有 `_jsx` 前缀嗅探**。

```
TSX 源码
  │  L1（@actview/compiler，Babel，enforce:'pre'）
  ▼
含 JSX + defineComponent(...) 的模块
  │  L2（宿主 esbuild / tsc automatic runtime，jsxImportSource=@actview/jsx）
  ▼
纯 JS（jsx()/jsxs()/Fragment 调用，无 JSX）
```

---

## 2. L1：组件函数 → `defineComponent(setup)`

### 2.1 输入域（谁是组件）

只按**声明位置 + 命名**判定，**不读函数返回什么**：

| 视为组件 | 例子 |
|---|---|
| 具名函数声明（任意深度） | `function A(props) { return <div/> }` |
| 变量声明 + 函数表达式/箭头 | `const B = (p) => <p/>`、`const C = function (p) { ... }` |
| 默认导出（函数声明/匿名函数/箭头） | `export default () => <div/>`、`export default function Named(){...}` |
| 命名导出同上 | `export function A(){...}`、`export const A = () => ...` |
| 入口归一化 | 先剥 `as` / `!` / `satisfies` 再匹配 |

命名门槛：`/^[A-Z]/`（默认导出豁免，匿名也能包）。

**不处理**（明确列进契约）：对象属性 `{ A: () => … }`、赋值 `A = () => …`、类方法/字段、HOC（`memo(...)`）、三元/`||` 包裹的函数值。

### 2.2 变换

```
组件体 = setup：
  对函数自身（排除嵌套函数）的每条直接 return：
    无参数 return                → return () => null
    return 箭头 / 函数字面量      → 错误（已废弃 setup 风格；render 由编译器生成）
    其他                          → return () => <原表达式>
  箭头 expression body           → body 变成 { return () => <原 body> }
  最后一条语句不是 return         → 追加 return () => null
  generator                      → 错误；async / typeParameters 保留；剥离 returnType
```

输出形态（`name` 来自声明名；匿名默认导出不传 name）：

```tsx
// 输入
function Counter(props) {
  const n = props.start
  return (
    <>
      <button class="btn" onClick={() => props.onInc()}>{n}</button>
    </>
  )
}

// L1 输出（仍含 JSX；组件已交付为 defineComponent）
import { defineComponent } from '@actview/runtime-core'

const Counter = defineComponent(function (props) {
  const n = props.start
  return () => (
    <>
      <button class="btn" onClick={() => props.onInc()}>{n}</button>
    </>
  )
}, "Counter")
```

其它形态：

```tsx
// 箭头 expression body
const Badge = (props) => <span>{props.label}</span>
// →
const Badge = defineComponent((props) => {
  return () => <span>{props.label}</span>
}, "Badge")

// 早退 + 尾部 return（条件在 setup 期求值一次）
function Status(props) {
  if (props.error) return <div>{props.error}</div>
  return <div class="ok" />
}
// →
const Status = defineComponent(function (props) {
  if (props.error) return () => <div>{props.error}</div>
  return () => <div class="ok" />
}, "Status")

// 可能落空 → 补 fallback
function Maybe(props) { if (props.show) return <div /> }
// →
const Maybe = defineComponent(function (props) {
  if (props.show) return () => <div />
  return () => null
}, "Maybe")

// 默认导出（具名默认导出保留 name）
export default function Named(props) { return <div/> }
// →
export default defineComponent(function (props) { return () => <div/> }, "Named")

// 幂等：已是 defineComponent 调用的 init 跳过
const X = defineComponent(function () { return () => <div/> })
```

### 2.3 错误面（只有这些）

| 输入 | 行为 |
|---|---|
| 组件体 `return () => JSX` / `return function () {}` | 编译期报错（带代码帧）：「已废弃的 setup 风格，直接 return JSX」 |
| generator 组件 | 编译期报错 |
| 其它 | 不报错（落空自动补 `() => null`；裸 `return;` 归一为 `() => null`） |

### 2.4 语义后果（写进契约）

1. setup 只执行一次 → 早退/`if`/`switch` 里的条件在 setup 期求值一次；需要响应式条件请写在 return 表达式里（三元）。
2. render 只有"那个 return 表达式" → 每次渲染都要执行的逻辑必须写在表达式内（三元 / IIFE / 子组件）。
3. 函数声明变 `const` → 失去函数提升。
4. PascalCase 声明位置 = 组件 → 回调/工具函数用 camelCase。

### 2.5 运行时契约（L1 依赖）

```ts
// @actview/runtime-core
type SetupFunction<P> = (props: P, ctx: SetupContext) => RenderFunction
type RenderFunction = () => Element | null

// defineComponent 不包对象：直接在 setup 函数上打标记并原样返回
type Component<P> = SetupFunction<P> & {
  readonly __actview_component: true
  readonly name?: string
}
```

- 渲染层用 `isComponent(fn)` 判定组件（`typeof fn === 'function' && fn.__actview_component === true`）；
- L1 生成 `defineComponent(setup, name)`，产物在运行期就是"带标记的 setup 函数"，没有 `__setup` 字段、没有额外包装对象。

---

## 3. L2：宿主 automatic runtime（不在 compiler 里）

JSX 降级交给标准工具链；运行时入口为 `@actview/jsx/jsx-runtime`：

| 输入 | 输出 |
|---|---|
| `<div/>` | `jsx('div', {})` |
| `<A/>` / `<A.B/>` | `jsx(A, {})` / `jsx(A.B, {})` |
| `<></>` | `jsx(Fragment, { children: ... })` |
| 多个 children | `jsxs(type, { children: [...] })` |
| `key` 属性 | 第三个参数 |
| `{...props}` | 对象展开 |
| 文本 | 按 React/esbuild 规则折叠空白后进 `children` |

```tsx
// L1 输出（含 JSX）
const Counter = defineComponent(function (props) {
  const n = props.start
  return () => <button class="btn">{n}</button>
}, "Counter")

// 宿主 automatic runtime 降级后
import { jsx } from '@actview/jsx/jsx-runtime'
const Counter = defineComponent(function (props) {
  const n = props.start
  return () => jsx('button', { class: 'btn', children: n })
}, 'Counter')
```

**为什么不在 compiler 里做**：

1. `tsconfig` 的 `jsx: react-jsx` + `jsxImportSource: @actview/jsx` 已配置，esbuild / tsc 直接支持 automatic runtime；
2. 避免重复实现（文本空白、key 提升、属性展开、别名冲突等）并与宿主语义 drift；
3. compiler 的契约因此更窄：**输入 JSX、输出 JSX，只改函数定义**，不产生也不解析任何 JSX 语义。

宿主接入（Vite）：

```ts
import { actviewCompiler } from '@actview/compiler/vite'

export default {
  plugins: [
    // enforce:'pre' —— L1 先于 esbuild；esbuild 随后完成 JSX 降级 + TS 剥离
    actviewCompiler({ exclude: [/[\\/]node_modules[\\/]/, /[\\/]packages[\\/]/] }),
  ],
}
```

纯 Babel 环境（无 Vite/esbuild/tsc）时，自行加标准插件：

```ts
babel.transformSync(code, {
  plugins: [
    [wrapComponentsPlugin, {}], // L1
    ['@babel/plugin-transform-react-jsx', { runtime: 'automatic', importSource: '@actview/jsx' }], // L2
  ],
})
```

> 本仓库的 Vite 配置默认排除 `packages/`：库包源码用显式 `defineComponent`（L1 对调用表达式幂等跳过），避免把库里的 PascalCase 工具函数误当组件；需要时给库包加编译步骤，或调整 `exclude`。

---

## 4. 不变量（验收标准）

| # | 不变量 | 守护位置 |
|---|---|---|
| I1 | 每个组件候选在输出中恰好一次 `defineComponent(...)`；非组件函数不被触碰 | `compiler/__tests__/wrap.spec.ts` |
| I2 | 绑定名/导出形态守恒（`function A` → `const A`；默认导出示意保留） | 同上 |
| I3 | setup 沿任意控制流路径都以 `return <函数字面量>` 结束（含 fallback） | 同上 |
| I4 | 原函数体非 return 语句原样保留；每条 return 表达式恰好出现一次（位于某个 `() => E` 内） | 同上 |
| I5 | JSX 节点与输入一一对应（未改写、未新增）；L1 不注入 jsx runtime import | `compile.spec.ts` |
| I6 | 除 `defineComponent` 外不注入运行时依赖 | 同上 |
| I7 | 幂等：`L1(L1(x)) = L1(x)` | `wrap.spec.ts` |
| I8 | 错误面固定（见 2.3） | `wrap.spec.ts` |
| I9 | 宿主无关性：L1 对「原始 TSX」与「已用 automatic runtime 降级的 JS」产出同形态包装（不读 JSX） | `compile.spec.ts` |

---

## 5. 验证命令

```bash
pnpm exec vitest run packages/compiler/__tests__/wrap.spec.ts
pnpm exec vitest run packages/compiler/__tests__/compile.spec.ts
pnpm -C packages/compiler typecheck
pnpm -C packages/compiler build
# 整链路（L1 + esbuild automatic runtime）
pnpm exec vite build
```

---

## 6. 与旧实现的差异（决策记录）

1. **不再按"返回值形状"判定组件**：旧实现需要识别 JSX / `_jsx()` / null / 三元，导致 if-else、`props.children`、类型断言等漏判或误判；新契约只按声明位置 + 命名判定，L1 完全不读 JSX。
2. **不再有 `__setup` 包装对象**：`defineComponent` 直接给 setup 函数打 `__actview_component` 标记并原样返回，渲染层用 `isComponent` 判定。
3. **不在 compiler 里重复实现 JSX 转换**：L2 交给宿主 automatic runtime（esbuild/tsc/Babel 标准插件），compiler 只保留 L1；`@actview/jsx` 提供的是运行时（`jsx`/`jsxs`/`Fragment`）与 JSX 类型，不是"转换器"。
4. **插槽等特性不进编译器核心**：`<template slot>` 等属于后续功能层；L1 契约先保持最小。
