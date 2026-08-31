# @actview/plugin-jsx

**React 语义 JSX 编译器 for ActView v2** —— fork 自 `@vue/babel-plugin-jsx`（v3.0.0），JSX 编译产物直出 `createVNode`，与 Vue 模板编译产物运行时同构；语法层面对齐 React。

## 核心功能

- **React 语义映射**（编译期，仅原生元素；组件 props 原样保留）：
  - `className` → `class`（Vue patchProp 不认识 className）
  - `htmlFor` → `for`（JSX 保留字）
  - `onChange` → `onInput`（text-like input/textarea；checkbox/radio/select 保留——React 里本就是 change 事件）
  - `dangerouslySetInnerHTML={{ __html }}` → `innerHTML`
- **自动 defineComponent 包装**（React 函数组件语义）：PascalCase 且含 JSX 的函数自动包 `defineComponent`——三种形态：
  - `function App() { return () => <JSX/> }`（setup 返回 render）
  - `const App = () => <JSX/>`（箭头 expression body）
  - `function App() { return <JSX/> }`（直接 return JSX 简写）
  - 手动 `defineComponent` 包装跳过；小写函数不处理；自动注入 `import { defineComponent } from 'actview'`
- **Vue 指令属性**：`v-model` / `v-show` / `v-html` / `v-text` / `v-slots` 编译期展开/保留
- **产物形态**：`createVNode(tag, props, children, patchFlag?, dynamicProps?)`（`optimize` 选项开启 patchFlag 静态分析）

## 安装

```bash
pnpm add -D @actview/plugin-jsx
```

## 使用（通常经 @actview/plugin-vite 接入）

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { actviewJsxPlugin } from '@actview/plugin-vite'

export default defineConfig({
  plugins: [actviewJsxPlugin()],
})
```

`tsconfig.json` 配 `jsxImportSource: "actview"`（JSX 类型来自 `actview/jsx-runtime` 的全局声明）。

## 选项

```ts
interface VueJSXPluginOptions {
  /** patchFlag 静态分析（createVNode 第 4/5 参） */
  optimize?: boolean
  /** class/style/on* 冲突合并为数组（spread 场景） */
  mergeProps?: boolean
  /** 自定义元素判定 */
  isCustomElement?: (tag: string) => boolean
  /** 对象 slots 语法 */
  enableObjectSlots?: boolean
  /** createVNode 覆盖（pragma 注释） */
  pragma?: string
  /** React 函数组件语义：PascalCase 含 JSX 函数自动包 defineComponent（默认 true） */
  autoDefineComponent?: boolean
  /** 自动包装时 defineComponent 的 import 来源（默认 'actview'） */
  defineComponentSource?: string
}
```

## 与 @vue/babel-plugin-jsx 的差异

- 移除 `resolveType`（TS 类型推断）与 `transformOn`（`on:` 对象语法）
- 新增 React 语义映射（见上）与自动 defineComponent 包装

## 依赖关系

- `@babel/core`（^8，peer）
- `@babel/helper-module-imports` / `@babel/helper-plugin-utils` / `@babel/plugin-syntax-jsx` / `@babel/template` / `@babel/types` / `@vue/shared`

## License

MIT
