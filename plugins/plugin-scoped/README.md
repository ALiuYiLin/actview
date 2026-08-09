# @actview/plugin-scoped

**Vue-like scoped CSS for ActView** —— 纯编译期的 CSS 隔离方案。

只需要在 CSS import 上带 `?scoped` query，该文件内所有 JSX 元素就会自动获得 scoped 属性，样式选择器同步追加属性选择器 —— 零运行时成本，`renderToString` 天然兼容。

## 特性

- 🎯 **零标记启用**：`import './x.css?scoped'` 即开启，无需 `useScoped` / `<style scoped>` 之类的额外标记
- 📦 **文件级作用域**：带 `?scoped` 的文件内**所有** JSX 元素自动注入 `data-v-<hash>`（含嵌套函数 / 条件渲染）
- ⚙️ **PostCSS 变换**：移植 Vue 3 `compiler-sfc` 的 scoped 实现（`:deep()` / `:slotted()` / `:global()`、keyframes 重命名）
- ⚡ **零运行时成本**：全部在编译期完成，产物无运行时依赖
- 🖥 **SSR 兼容**：注入的属性随 VNode 序列化，`renderToString` 直接输出
- 🔀 **双形态兼容**：同时支持源码 JSX 与已被 esbuild/rolldown 降级的 `_jsx()` 调用

## 安装

```bash
pnpm add -D @actview/plugin-scoped
# 或 npm i -D @actview/plugin-scoped
```

## 快速开始

### 1. 接入 Vite 插件

`vite.config.ts`：

```ts
import { defineConfig } from 'vite'
import { actviewPlugin } from '@actview/plugin-vite'
import actviewScopedPlugin from '@actview/plugin-scoped'

export default defineConfig({
  plugins: [actviewPlugin(), ...actviewScopedPlugin()],
})
```

> `actviewScopedPlugin()` 返回两个 `enforce: 'pre'` 子插件（CSS 变换 + JSX 注入），需展开后放入 `plugins` 数组。

### 2. 启用 scoped

```tsx
// App.tsx —— import 带 ?scoped 即开启本文件的 scoped 隔离
import './index.css?scoped'

export function App() {
  return (
    <div class="card">
      <span>hi</span>
    </div>
  )
}
```

```css
/* index.css —— 选择器由插件自动追加 [data-v-<hash>] */
.card {
  padding: 16px;
  background: #fff;
}
```

编译后等价于：

```tsx
<div class="card" data-v-3c0b0324>
```

```css
.card[data-v-3c0b0324] {
  padding: 16px;
  background: #fff;
}
```

没有 `?scoped` import 的文件则完全不受影响（等价于未开启 scoped）。

## 工作原理

1. **JSX 侧（Babel 插件）**：检测文件内带 `?scoped` query 的 `.css` import → 计算 hash → 给文件内**所有** JSX 元素注入 `data-v-<hash>=""` 属性（源码 JSX 与 `_jsx(type, props)` 两种形态都支持）。
2. **CSS 侧（PostCSS 插件）**：对每个选择器的最后一个简单选择器追加 `[data-v-<hash>]`。
3. **hash 一致性**：`hash = md5(剥掉 query 的绝对路径).slice(0, 8)`，CSS 与 JSX 两侧基于同一路径计算，保证选择器与 DOM 属性匹配；JSX 侧经 Vite resolver（`this.resolve`）解析 import，alias / 裸包路径同样一致。

```
import './x.css?scoped'   ──►   Babel 注入 data-v-xxxx   ──►   <div class="x" data-v-xxxx="">
                                PostCSS 变换选择器        ──►   .x[data-v-xxxx] { ... }
```

## scoped 语义

| 写法 | 编译结果 | 说明 |
|---|---|---|
| `.a .b { }` | `.a .b[data-v-h] { }` | 注入点：最后一个简单选择器 |
| `.a :deep(.b) { }` | `.a[data-v-h] .b { }` | 注入点前移，`.b` 不要求带属性（穿透子组件） |
| `.c :slotted(.d) { }` | `.c .d[data-v-h-s] { }` | 插槽内容元素（`<template slot>` 内）额外注入 `data-v-h-s` |
| `:global(.e) { }` | `.e { }` | 不注入 |
| `* { }` | `[data-v-h] { }` | 通配符单独时转为属性选择器 |
| `@keyframes spin` | `@keyframes spin-h` | keyframes 重命名，`animation` 引用同步改写 |

- **多个 `?scoped` import**：注入多个 hash，每个 css 文件独立作用域。
- **跨文件组件 root**：父组件透传到子组件根的 attrs（含 scoped 的 `data-v-*`）经运行时 fallthrough 自动继承到子组件 root（对齐 Vue「子 root 带父 scopeId」，多级嵌套逐级累积）——父的 `.classC[data-v-父]` 能命中透传 class 的子 root；**深入子组件内部元素**仍需 `:deep()`，例如 `.app nav :deep(a) { ... }`。

## API

### `actviewScopedPlugin(options?)`

默认导出 / 具名导出。返回 `[cssPlugin, jsxPlugin]` 两个 Vite 插件。

| 选项 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `attrPrefix` | `string` | `'data-v'` | 属性/选择器前缀（生成 `data-v-<hash>`） |
| `getHash` | `(absPath: string) => string` | `md5(absPath).slice(0,8)` | 自定义 hash 生成（CSS 与 JSX 侧共用） |

### 其他导出

| 导出 | 说明 |
|---|---|
| `transformScopedCSS(css, hash, attrPrefix?)` | 纯函数：对 CSS 应用 scoped 变换（PostCSS） |
| `getHash(absPath)` | 纯函数：`md5(绝对路径).slice(0,8)` |
| `scopeAttr(hash, attrPrefix?)` | 纯函数：生成 `data-v-<hash>` |
| `scopedBabelPlugin({ resolveCssPath, attrPrefix? })` | Babel 插件（可脱离 Vite 单独使用） |
| `ScopedPluginOptions`（类型） | 插件选项类型 |

## 已知限制

- **文件级语义**：同文件内所有组件都会带 hash（包括想保持全局的组件）；跨文件组件不受影响。若需细分作用域，请拆分为独立文件。
- **`:slotted()` 仅同文件内有效**：纯编译期方案无运行时 scope 传递，插槽内容的 `-s` 属性只在父组件文件内注入。
- **`useScoped` 已移除**：v0.1.0 的 `useScoped(styles)` 标记在 v0.2.0 移除（breaking），改用 `?scoped` import。

## 开发

```bash
pnpm build   # tsup 打包 dist + rewrite-package 生成 dist/package.json
pnpm test    # vitest（css / babel 单元测试 + 集成测试）
```

## License

MIT
