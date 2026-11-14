# VitePress → ActView 迁移方案

> 基线：`vitepress@2.0.0-alpha.17` 的 `src`（MIT，Copyright Yuxi (Evan) You）。
> 源码已导入 `packages/vitepress/src`，保留上游 `LICENSE.vitepress`。
>
> 目标：保留 VitePress 的 Markdown / 配置 / 路由 / 构建生态，把客户端 App、默认主题和 Markdown 页面输出改为 ActView。

## 1. 结论先行

这件事**不是简单替换一个 renderer**：

- `src/node` 的 Markdown / config / server / dead-link 逻辑基本可复用；
- `src/client/app` 和 `theme-default` 是 Vue 运行时 + Vue SFC，必须重写；
- 默认主题有 **92 个 `.vue` 文件、约 6k 行模板/脚本**，并大量使用 slots、provide/inject、composables、`defineAsyncComponent`、`useSSRContext`；
- Markdown 允许嵌入 Vue 组件、`v-*` 指令和 `{{ }}`，HTML→JSX 不是纯 HTML 转换。

建议分两条线推进：

1. **先做能跑的 MVP 文档站**：Markdown → HTML → ActView 页面组件 + 最小主题壳；
2. **再做默认主题完整移植**：按导航 / 侧栏 / 文档页 / 首页逐步替换，最后补 SSR 和搜索等交互。

不要一开始就机械地把 92 个 `.vue` 改成 `.tsx`，否则会在 slots / composables 层反复返工。

## 2. 目标包结构

```text
packages/vitepress/
  package.json                 @actview/vitepress（先 private）
  LICENSE.vitepress            上游 MIT
  MIGRATION.md
  src/
    shared/                    原样复用（类型 / 工具）
    node/                      VitePress node 层（逐步去 Vue）
      markdown/                原样复用 markdown-it 插件
      markdownToActview.ts     新：md → ActView 页面模块
      plugin.ts                改：移除 @vitejs/plugin-vue
      config.ts / server.ts    改：Vue SSR → ActView SSR
    client/
      app/                     ActView app / router / data / head
      markdown/                html → VNode / JSX 代码生成
      theme-default/           新 ActView 主题（同 CSS / DOM 结构）
      components/              VitePress 公共组件
```

依赖方向：

```text
@actview/vitepress
  ├─ vitepress node/shared 代码（MIT）
  ├─ actview
  ├─ @actview/core
  ├─ @actview/router
  ├─ @actview/server（SSR）
  ├─ vite / markdown-it / shiki
  └─ 不再依赖 vue / @vitejs/plugin-vue
```

## 3. Markdown 管线

### 3.1 保留

```text
.md
→ markdown-it + @mdit-vue plugins
  （frontmatter / headers / sfc blocks / anchors / containers / code highlight / link / image）
→ HTML + pageData + links + sfcBlocks
```

`src/node/markdown` 与 `src/shared` 基本不动。

### 3.2 替换 `markdownToVue`

原输出：

```vue
<script>
export const __pageData = ...
export default { name: 'guide.md' }
</script>
<template><div>${html}</div></template>
<style>...</style>
```

新输出（目标）：

```tsx
import { ActViewComponent, Component } from 'actview'
import { components } from '../client/theme-default/components'

export const __pageData = {...}

@Component({ name: 'guide.md' })
export default class Page extends ActViewComponent {
  render() {
    return (
      <div class="vp-doc">
        <h1 id="intro">Intro</h1>
        ...
        <VPBadge type="tip">New</VPBadge>
      </div>
    )
  }
}
```

### 3.3 HTML → JSX 的两种实现

#### 方案 A：运行时 `htmlToVNode`（MVP 推荐）

```tsx
render() {
  return htmlToVNode(page.html, componentMap)
}
```

- 用 `parse5` / 浏览器 `DOMParser` 把 HTML 转成 VNode；
- 标准标签直接建 VNode；
- 自定义标签通过 registry 映射到 ActView 组件；
- SSR 与客户端共用同一转换逻辑；
- 优点：快速跑通，兼容任意 markdown-it 输出；
- 缺点：页面加载时解析 HTML，客户端体积增加，无法做编译期校验。

#### 方案 B：构建期 HTML → JSX 代码生成（最终推荐）

```text
HTML AST (parse5)
→ JSX/TSX source
→ Vite esbuild 编译
→ ActView 页面模块
```

- 标准节点输出 JSX；
- 自定义组件输出 `createElement(components.VPBadge, props, children)`；
- 文本用 `{JSON.stringify(text)}`，避免 JSX 转义问题；
- 优点：无运行时 parser、SSR 快、可做编译期错误；
- 缺点：要处理 HTML 解析/属性/SVG/自定义组件，开发量更大。

**建议**：先用方案 A 做端到端 MVP；主题壳稳定后切换到方案 B，A 保留为 fallback（处理 `<script setup>` 或无法静态化的页面）。

### 3.4 Markdown 中的 Vue 语法

必须明确支持级别：

| 语法 | MVP | 后续 |
|---|---|---|
| 标准 Markdown / 容器 / 代码块 / 链接 | ✅ | ✅ |
| 原生 HTML | ✅ | ✅ |
| `<VPBadge>` 等已注册组件 | ✅ registry | ✅ |
| `v-pre` / `{{ }}` 静态文本 | 按文本处理 | 可选编译 |
| `v-if` / `v-for` / `v-html` | ❌ 报 warning | 指令转换 |
| `<script setup>` | ❌ 先禁用 | 转 page class 字段/方法 |
| `<style>` / `<style scoped>` | 提取为 CSS | 作用域改写 |
| 自定义块 | 原样保留/忽略 | 插件约定 |

这不是“偷懒”，而是把 Vue 模板编译器从链路中移除后必须补的语义。第一版应明确报错，而不是静默输出错误 DOM。

## 4. 客户端 App 重写

VitePress `src/client/app` 的职责保留，但实现全部替换：

| VitePress | ActView |
|---|---|
| `createSSRApp(VitePressApp)` | `createSSRApp` / `createApp` |
| `app.component('Content', ...)` | 全局组件 registry / `Dynamic` |
| Vue router reactive route | ActView `@Ref` route store + `@actview/router` 或保留 VitePress 路由逻辑改写 |
| `provide(RouterSymbol, router)` | `app.provide` + `@Inject(RouterSymbol)` |
| `initData` reactive data | `@Model` / app service，暴露 `useData` 等价物 |
| `useUpdateHead` | ActView `@Mounted/@Watch` + DOM head 管理；或 `useSSRContext` head |
| `Theme.enhanceApp` | ActView plugin / theme install |
| `usePrefetch` / copy code / code groups | ActView `@Mounted` 全局 DOM 行为 |

### 推荐数据层

```text
SiteData / ThemeConfig / PageData
        │
        ▼
App 级 service（@Scope('app') Model 或 app.provide）
        │
        ├─ useData()        组件 @Inject
        ├─ useRoute()       Router service
        └─ useLayout()      Layout 状态
```

不要在每个主题组件里各自维护一份 site config。

## 5. 默认主题移植

### 5.1 不直接 1:1 改模板

Vue 主题的核心难点不是 HTML，而是：

- slots（Layout 有 30+ 个具名 slot）；
- composables（`useData` / `useSidebarControl` / `useLayout` / `useOutline`…）；
- Vue 生命周期 / `watchEffect` / `useTemplateRef`；
- `defineAsyncComponent`；
- `provide/inject`；
- `useSSRContext`。

ActView 没有 slots，需要把 slot 改成**显式 render props**：

```tsx
<VPNav
  navBarTitleBefore={() => <span>...</span>}
  navBarContentAfter={() => ...}
/>
```

Layout 先定义 `ThemeSlots` 接口和默认空渲染；第一版只实现 docs 必需的 slot。

### 5.2 建议组件顺序

| 批次 | 组件 | 说明 |
|---|---|---|
| 1 | `Layout` / `VPNav` / `VPSidebar` / `VPContent` / `VPDoc` / `VPFooter` / `VPLocalNav` / `VPBackdrop` / `VPSkipLink` | 站壳，先能显示 docs |
| 2 | 图标组件 | 模板基本是 SVG，机械转换 |
| 3 | `VPPage` / `VPDocFooter` / `VPDocAsideOutline` / `VPHome*` / `VPHero` / `VPFeatures` | 文档页 + 首页 |
| 4 | `VPNavBar*` / 菜单 / 翻译 / 外观切换 / flyout | 交互 |
| 5 | `VPLocalSearchBox` / Algolia / Carbon / Sponsors / Team | 可选，最后 |

### 5.3 样式

- 复制 `styles/` 和 `fonts/`；
- 92 个 SFC 的 `<style scoped>` 需要提取并改写作用域；优先保留原有类名，用构建期的 CSS scoping 或统一前缀；
- 不要求第一版像素级一致，先保证结构和响应式布局。

## 6. SSR / 构建

VitePress node 层有完整的 SSR 入口、client manifest、HMR、dev server。切换 ActView 后：

1. `.md` 变成 ActView 页面模块，不再经过 `@vitejs/plugin-vue`；
2. 客户端入口 `createSSRApp` + `hydrate`；
3. 服务端入口用 `@actview/server` 的 `renderToString` / `renderToHTML`；
4. Vite plugin 去掉 Vue alias / Vue SSR external / Vue SFC 处理；
5. page module 的 `__pageData` 保留，`Content` 用动态组件加载；
6. 主题 CSS 作为普通 CSS 进入构建。

SSR 是第二阶段目标；建议先做纯 SPA 文档站验证主题和 Markdown，再接 SSR。

## 7. 分阶段计划

### Phase 0：基线与脚手架（已完成）

- ✅ 导入 `src`、上游 LICENSE；
- ✅ 新建 `@actview/vitepress` 包配置；
- ✅ ActView 实现直接落在 `src/client` / `src/node` / `src/shared`，不再使用独立的 `src/actview` 目录；
- ✅ 已下线的 `Layout.vue` 改为 `src/client/theme-default/Layout.tsx`；
- ✅ 引入 `theme-default/extract-css` 的完整剥离 CSS（`*.scoped.css`），接入 `@10coding/vite-plugin-jsx-scoped`（通过 pnpm patch 支持 legacy decorators）。

### Phase 1：Markdown → ActView 页面（MVP，已完成）

- ✅ `markdownToActview`（markdown-it + anchor + gray-matter 的最小 VitePress 子集）；
- ✅ `htmlToVNode`（方案 A）；
- ✅ `.md` Vite 插件；
- ✅ 最小 `Layout` + `vp-doc` 样式；
- ✅ `playground/vitepress` 可运行示例；
- ✅ 单测：frontmatter / heading id / code block / raw HTML / custom component / 指令诊断 / VNode mount。

验收：`pnpm dev:vitepress` 可打开 Markdown 页面；`pnpm build:vitepress` 通过。

> 注意：Phase 1 没有接入 VitePress 的完整 markdown 插件（shiki / containers / sfc blocks / dead links）；这些在后续阶段补齐。

验收：给定一个 `.md` 能生成可挂载的 ActView 页面。

### Phase 2：客户端壳与路由

- ✅ `createDocsApp`：页面 glob 加载、pageData / headers / sidebar / route 更新；
- ✅ popstate 切页；
- ✅ 最小 Layout + 完整主题 Layout 已接通；
- ✅ docs 页面可浏览（含侧栏 / footer / outline）；
- 待补：VitePress 完整 siteConfig / rewrites / 404 / 预取。

验收：本地 dev 打开 docs，导航、侧栏、文档内容可用。

### Phase 3：默认主题核心

- 站壳 + 文档页 + 首页；
- 外观切换 / 侧栏 / outline / footer；
- 样式对齐；
- 先跳过搜索 / 广告 / 赞助。

验收：默认主题的主要页面结构与交互可用。

### Phase 4：完整主题与 SSR

- 导航菜单 / 搜索 / 翻译 / 可选组件；
- ActView SSR + hydration；
- VitePress build / preview / HMR；
- E2E / 视觉回归。

验收：生产构建、静态站点、多页面、SSR 首屏可用。

## 8. 风险与待确认

1. **Vue 模板语法**：Markdown 内的 `v-*` / 插值是否需要支持？如果要 100% 兼容，需要实现一个 Vue-template 子集编译器，工作量会显著增加。
2. **主题范围**：是否要求默认主题 100% 像素级一致？建议先 docs 主路径，搜索/广告/赞助/团队页后置。
3. **SSR 时机**：先 SPA 还是直接 SSR？建议先 SPA。
4. **包名**：建议 `@actview/vitepress`，避免与上游 `vitepress` 混淆；保留 `private: true` 直到稳定。
5. **上游同步**：这是 fork 而非插件，后续同步成本高；建议固定 alpha.17 基线，不承诺自动合并。

## 9. 推荐的第一刀

不要先改 92 个 `.vue`。先做一个**纵向切片**：

```text
一个 guide.md
→ markdownToActview
→ Page 组件
→ htmlToVNode
→ 最小 Layout
→ 浏览器可打开
```

这个切片跑通后，再决定：

- 继续用运行时 `htmlToVNode`，还是切构建期 JSX 代码生成；
- 主题是完整移植，还是只移植 docs 主路径。

MVP 切片完成后，剩余工作主要是主题组件和 SSR 工程化，不再受 Markdown 管线阻塞。
