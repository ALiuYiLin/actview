# TS 类型系统实现原理（@actview/jsx）

> 源码：`packages/jsx/src/types.ts`、`packages/jsx/src/global.ts`
> 目标：完整 TSX 类型——全量 `IntrinsicElements`（HTML + SVG）、ARIA、完整事件、组件 props 严格化。

---

## 1. 总览

TS 的 JSX 类型检查由 `jsx: "react-jsx"` + `jsxImportSource: "@actview/jsx"` 驱动，编译器读取 `@actview/jsx` 包导出的全局 `JSX` namespace：

```
JSX.IntrinsicElements      → DOM 元素（<div> 等）的 props 类型
JSX.IntrinsicAttributes    → 所有元素的公共属性（key/ref）
JSX.ElementChildrenAttribute → children 属性名
JSX.LibraryManagedAttributes → 组件元素的 props 类型变换
```

---

## 2. 属性类型分层（types.ts）

### 2.1 DOMAttributes（事件全量）

```ts
export interface DOMAttributes {
  onClick?: EventHandler<MouseEvent>
  onKeyDown?: EventHandler<KeyboardEvent>
  onInput?: EventHandler<FormEvent>
  // ... 鼠标/键盘/焦点/表单/剪贴板/拖拽/指针/触摸/媒体/动画
  // capture 变体 + 小写兼容（onclick 等）
}
```

`EventHandler<E> = (e: E) => void`，直接原生 DOM 事件（无 SyntheticEvent 包装）。

`FormEvent` 自定义：`target` 带 `value`/`checked`（ActView 的 `onInput`/`onChange` 用）。

### 2.2 AriaAttributes（模板索引签名）

```ts
export interface AriaAttributes {
  [key: `aria-${string}`]: string | number | boolean | undefined
}
```

模板字面量索引签名：**所有 `aria-*` 属性**自动允许，无需逐个声明。

### 2.3 HTMLAttributes（通用属性，无宽索引签名）

```ts
export interface HTMLAttributes extends AriaAttributes, DOMAttributes {
  children?: VNodeChildren
  key?: string | number | null
  ref?: any
  id?/class?/className?/style?/title?/...
  [key: `data-${string}`]: unknown
  // 无 [key: string]: unknown —— 自定义属性请用 data-*
}
```

关键设计：**不带宽索引签名**。这样 `<div foo="bar">`（非 data-* 自定义属性）报错，对齐 React。

### 2.4 元素专属属性

`AnchorHTMLAttributes`/`ImgHTMLAttributes`/`InputHTMLAttributes`/`SelectHTMLAttributes` 等 extends `HTMLAttributes` 加专属字段（href/src/value/checked/...）。

### 2.5 SVGAttributes

`viewBox`/`fill`/`stroke`/`cx`/`cy`/`r`/`d`/`points` 等 SVG 专属属性。

---

## 3. IntrinsicElements（global.ts）

```ts
interface IntrinsicElements {
  // 通用 HTML（约 80 个标签 → HTMLAttributes）
  div/span/p/h1.../li/...: HTMLAttributes
  // 专属属性标签
  a: AnchorHTMLAttributes
  input: InputHTMLAttributes
  img: ImgHTMLAttributes
  // ... 约 30 个
  // SVG（约 50 个标签 → SVGAttributes）
  svg/circle/path/g/rect/...: SVGAttributes
  // 动态组件占位
  component: HTMLAttributes & { is?: any }
  // 兜底
  [tag: string]: HTMLAttributes
}
```

### 3.1 IntrinsicAttributes

```ts
interface IntrinsicAttributes {
  key?: string | number | null
  ref?: any
}
```

所有 JSX 元素（DOM + 组件）自动合并的公共属性（TS 对 intrinsic 元素自动合并 `IntrinsicAttributes`）。

---

## 4. 组件 props 严格化（LibraryManagedAttributes）

```ts
type LibraryManagedAttributes<C, P> = P & HTMLAttributes
```

- **`P`**：组件声明的 props 类型（`function App(props: AppProps)` 的 `AppProps`），必填属性强制
- **`& HTMLAttributes`**：额外仅允许 HTML 属性（class/style/id/on*/data-*/aria-*），任意自定义 prop 报错

对比之前的 `P & Record<string, any>`（任意额外属性 any），现在：
- `<App name="x" foo="bar">` → `foo` 不在 `HTMLAttributes`，报错 ✅
- `<App name="x" class="btn" onClick={...}>` → class/onClick 在 `HTMLAttributes`，允许 ✅

### 4.1 组件 props 类型推导

```ts
type PropsOf<T> = T extends { __setup: (props: infer P) => any } ? P
  : T extends (props: infer P) => any ? P : {}
```

`defineComponent` 函数形态重载保留 setup 参数类型，JSX 里 `<App {...} />` 用 `PropsOf` 推导 props。

---

## 5. 设计取舍

| 项 | 决策 |
|---|---|
| 合成事件类型 | ❌ 砍（原生事件直连） |
| 宽索引签名 | ❌ 去掉（`HTMLAttributes` 只留 `data-*` 模板），严格化组件 props |
| 小写事件 | ✅ 兼容（`onclick` 等历史写法） |
| children | `VNodeChildren` 含 `void`（`{fn()}` 返回 void） |
