---
title: ActView Markdown MVP
---

# ActView Markdown MVP

这是 Phase 1 的最小纵向切片：Markdown 由 Vite 插件转换成 ActView 页面组件，
再通过 `htmlToVNode` 变成 VNode。

## 支持范围

- 标准 Markdown 标题、段落、列表、链接；
- 代码块；
- 原始 HTML；
- frontmatter。

```ts
import { createApp } from 'actview'
import Page from './guide.md'

createApp(Page).mount('#app')
```

## 原始 HTML

<div class="custom-html">
  <strong>这段是 Markdown 里的原始 HTML。</strong>
</div>

> Phase 1 不支持 Vue 指令、`{{ }}` 和 `<script setup>`。
