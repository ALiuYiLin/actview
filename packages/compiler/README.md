# @actview/compiler

ActView 的 L1 编译器：把 TSX 里的**组件函数**包装成带 `__actview_component` 标记的 `defineComponent(setup)`。

```tsx
// 输入
function Counter(props) {
  const n = props.start
  return <button class="btn">{n}</button>
}

// L1 输出（仍含 JSX）
import { defineComponent } from '@actview/runtime-core'

const Counter = defineComponent(function (props) {
  const n = props.start
  return () => <button class="btn">{n}</button>
}, 'Counter')
```

`defineComponent` 不包对象：它返回**同一个 setup 函数**并写入 `__actview_component: true`，渲染层用 `isComponent(fn)` 判定。

## 只做 L1，JSX 降级交给宿主

本包**不**把 JSX 转成 `jsx()` 调用。JSX 降级（`<div/>` → `jsx('div')`）由宿主工具链的 **automatic runtime** 完成，运行时实现是 `@actview/jsx`：

- Vite / esbuild / tsc：`tsconfig.json` 里 `"jsx": "react-jsx"` + `"jsxImportSource": "@actview/jsx"` 已配置；
- 纯 Babel：使用 `@babel/plugin-transform-react-jsx`（`runtime: 'automatic'`, `importSource: '@actview/jsx'`）。

因此 compiler 不读 JSX、不碰 JSX 语义；**输入可以是原始 TSX，也可以是宿主已降级好的 JS**。完整分层契约见 [`docs/compiler-layers.md`](../../docs/compiler-layers.md)。

## 用法

### Vite（推荐）

```ts
// vite.config.ts
import { actviewCompiler } from '@actview/compiler/vite'

export default {
  plugins: [
    // enforce: 'pre' —— L1 先于 esbuild；esbuild 随后做 JSX 降级 + TS 剥离
    actviewCompiler({
      exclude: [/[\\/]node_modules[\\/]/, /[\\/]packages[\\/]/],
    }),
  ],
}
```

### Babel / 直接调用

```ts
import { compileComponents, wrapComponentsPlugin } from '@actview/compiler'

// L1：组件包装（产物仍含 JSX）
const { code, map } = compileComponents(source, { filename: 'App.tsx' })!

// 或直接用 Babel 插件
babel.transformSync(source, { plugins: [wrapComponentsPlugin] })
```

选项：`defineComponentSource`（defineComponent 导入源，默认 `@actview/runtime-core`）、`sourceMaps`（默认 true）、`retainLines`。

## 编译期语义（使用须知）

1. **setup 只执行一次**：`if` / 早退里的条件在 setup 期求值一次，不是每次渲染重判；条件渲染请写在 return 表达式里（三元）。
2. **render 只有那个 return 表达式**：每次渲染都要执行的逻辑要写在表达式内（三元 / IIFE / 子组件）。
3. **函数声明变 `const`**：失去函数提升。
4. **PascalCase 声明位置 = 组件**：render 回调 / 工具函数请用 camelCase。
5. **禁止 `return () => <div/>`**（已废弃的 setup 风格）：render 函数由编译器生成，直接 `return <div/>`。

## 验证

```bash
pnpm exec vitest run packages/compiler/__tests__/wrap.spec.ts
pnpm exec vitest run packages/compiler/__tests__/compile.spec.ts
pnpm -C packages/compiler typecheck
pnpm -C packages/compiler build
```
