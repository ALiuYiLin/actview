# @actview/vitepress

基于 VitePress 源码改造的 ActView 文档站工具。

- 上游基线：`vitepress@2.0.0-alpha.17`（MIT）
- 当前状态：**Phase 1 MVP 已跑通**（Markdown → ActView Page → VNode）
- 迁移方案：[MIGRATION.md](./MIGRATION.md)

## CLI 使用

`playground/vitepress` 是一个标准文档根目录，由默认主题 CLI 启动：

```text
playground/vitepress/
  .vitepress/config.ts
  index.md
  guide.md
```

```bash
pnpm dev:vitepress
# http://localhost:5173
```

CLI：

```bash
actview-press dev <docs-root>
```

当前 CLI 导出：

```json
{
  "bin": {
    "actview-press": "./bin/actview-press.js"
  }
}
```

`playground/vitepress` 不需要写 `main.ts`、`vite.config.ts` 或手动调用
`createDocsApp`；页面、默认主题、Markdown 插件、scoped CSS 都由 CLI 装配。

示例：

```text
playground/vitepress/
  docs/index.md
  src/main.ts
  vite.config.ts
```

`vite.config.ts`：

```ts
import { actviewMarkdown } from '@actview/vitepress/plugin'
import jsxScoped from '@10coding/vite-plugin-jsx-scoped'

export default defineConfig({
  plugins: [jsxScoped(), actviewMarkdown()],
  define: { __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production') },
  esbuild: { jsx: 'automatic', jsxImportSource: '@actview/jsx' },
})
```

`main.ts`：

```ts
import { createApp } from 'actview'
import { Layout } from '@actview/vitepress'
import Page from '../docs/index.md'

createApp(Layout, { page: Page }).mount('#app')
```

插件把 `.md` 转成：

```ts
class Page extends ActViewComponent {
  render() {
    return htmlToVNode(PAGE_HTML)
  }
}
```

## Phase 1 支持

- 标准 Markdown 标题 / 段落 / 列表 / 链接 / 引用；
- 代码块（无语法高亮，后续接 shiki）；
- frontmatter；
- 原始 HTML；
- `htmlToVNode(html, { components })` 自定义标签映射。

明确不支持（会报错）：

- `v-if` / `v-for` / `v-html` 等 Vue 指令；
- `{{ }}` 插值；
- `<script setup>`。

## 目录

```text
src/                  上游 VitePress 源码 + ActView 迁移
src/client/           ActView client 入口 / Markdown VNode / 主题 TSX
  index.ts
  markdown/htmlToVNode.ts
  theme-default/Layout.tsx
  theme-default/extract-css/
src/node/             Markdown 编译与 Vite 插件
  markdownToActview.ts
  actviewPlugin.ts
LICENSE.vitepress     上游 MIT 许可证
MIGRATION.md          架构与分阶段迁移方案
```

> Scoped CSS 使用 `@10coding/vite-plugin-jsx-scoped`；样式文件命名为 `*.scoped.css`，
> 导入即触发作用域注入。当前通过 pnpm patch 为 Babel 解析器补上 legacy decorators 支持。

## 下一步

Phase 2：ActView app / data / router / head + 最小主题壳。
