# @actview/babel-plugin-actview

**ActView 编译核心（Babel 插件）** —— 把 JSX 组件函数自动转换为 `defineComponent`，独立于 Vite 宿主。

Babel 插件 `defineComponentPlugin` 是 ActView 编译链的**核心**：将大写开头的函数 / 箭头 / 默认导出组件包装为 `defineComponent` 产物（`{ __setup }`），并完成具名插槽提取、props 白名单、早退 return 包装等转换。`@actview/plugin-vite` 与 `@actview/plugin-scoped` 都基于它。

同时本包导出**共享 Babel 宿主壳**（`createBabelTransform` / `createBabelItem` / `transformWithBabel`），供各 Vite 插件复用统一的 `transformSync` 调用参数。

## 核心功能

- **组件自动转换**：函数 / 箭头 / 默认导出组件 → `defineComponent`（自动注入 `import { defineComponent } from '@actview/core'`）
- **具名插槽**：`<template slot>` → `slots` prop（编译期提取）
- **props 白名单**：从 `defineComponent({ props })` 声明提取 `__props`
- **早退 return**：组件渲染函数中的 `if / 三元 / &&` 早退分支包装（`isRenderExpr`）
- **共享宿主壳**：`createBabelTransform` 等，统一 `parserOpts` / `retainLines` / `sourceMaps` / `babelrc:false` / `configFile:false`

## 安装

```bash
pnpm add -D @actview/babel-plugin-actview
```

## 快速开始

```ts
import { defineComponentPlugin } from '@actview/babel-plugin-actview'
import * as babel from '@babel/core'

const result = babel.transformSync(code, {
  filename: 'App.tsx',
  plugins: [[defineComponentPlugin, {}]],
  parserOpts: { plugins: ['jsx', 'typescript'] },
})
```

> 大多数场景不需要直接使用 —— 接入 `@actview/plugin-vite`（Vite 项目）即可自动完成转换。

## API

| 导出 | 说明 |
|---|---|
| `defineComponentPlugin`（默认导出同） | Babel 插件工厂：组件 → `defineComponent` 转换 |
| `createBabelTransform(plugin)` | 宿主壳工厂：模块级创建一次 ConfigItem，返回 `(code, filename) => { code, map } \| null` |
| `createBabelItem(plugin)` | 把插件工厂预编译为 ConfigItem（Babel 8 同步） |
| `transformWithBabel(code, filename, pluginItem)` | 统一参数的 `transformSync` |
| 类型：`BabelPlugin` / `BabelHostResult` | 宿主壳类型 |

## 依赖关系

- `@babel/core`（^8）
- 被依赖方：`@actview/plugin-vite`、`@actview/plugin-scoped`（复用宿主壳）

## 开发

```bash
pnpm build   # tsup 打包 dist
pnpm test    # vitest（test/plugin.test.ts：组件转换/插槽/props/早退等 30 用例）
```

## License

MIT
