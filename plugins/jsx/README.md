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
- **编译期 props 提取**（自动落根的前提）：组件函数第一参的类型注解（内联对象 / 同文件 `interface` / `type` / 默认值参数）经 `@vue/compiler-sfc` 的 `extractRuntimeProps` 降级为运行时 props 声明——`defineComponent(fn, { props: { step: { type: Number, required: false } } })`；actview 桥接按「有 props 声明」开启 `inheritAttrs`，未消费 attrs（class / data-* / 事件 / 透传属性）自动落到根元素，scoped 注入的 `data-v-*` 对 actview 组件生效
  - `children` 声明自动剔除（slots 桥接键，不能进 props 声明）
  - 类型不可解析（跨文件 import 类型 / 复杂类型 / `any`）→ warn 并跳过，组件退回无声明语义（不落根）
  - 显式 `defineComponent(fn)` 同样提取
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

- `resolveType` 重实现为**编译期 props 提取**（聚焦 auto-define 包装 + 显式 `defineComponent`，自动剔除 `children`，失败容错跳过——官方版对不可解析类型直接报错）
- 移除 `transformOn`（`on:` 对象语法）
- 新增 React 语义映射（见上）与自动 defineComponent 包装

## 依赖关系

- `@babel/core`（^8，peer）
- `@babel/helper-module-imports` / `@babel/helper-plugin-utils` / `@babel/plugin-syntax-jsx` / `@babel/template` / `@babel/types` / `@babel/parser` / `@vue/compiler-sfc` / `@vue/shared`

## License

MIT
