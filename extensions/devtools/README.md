# ActView DevTools Extension

ActView 的 Chrome DevTools 扩展（Manifest V3）。

面板 UI 使用 **ActView 自身**实现（`src/panel.tsx`），构建产物为 `build/panel.js`。

## 功能（v0.1）

- Components
  - App 选择
  - 组件树
  - 组件选择
  - props / state / computed / `@Model` 状态
  - renderCount
  - DOM 高亮
  - 页面元素选择 → 反查组件
- Events
  - mount / update / unmount / track / trigger
  - 暂停 / 继续
- Performance
  - mount / update 耗时
  - 渲染次数

## 前提

页面应用必须安装 `@actview/devtools` backend：

```ts
import { devtoolsPlugin } from '@actview/devtools'

if (import.meta.env.DEV) {
  app.use(devtoolsPlugin, { appName: 'My App' })
}
```

扩展只负责 UI / 桥接；数据采集在页面侧的 `@actview/devtools`。

## 加载扩展

先构建面板 UI：

```bash
pnpm build:extension
```

然后：

1. Chrome → `chrome://extensions`
2. 打开「开发者模式」
3. 「加载已解压的扩展程序」选择 `extensions/devtools`
4. 打开任意 ActView 页面 → 打开 DevTools → ActView 面板

## 文件

```text
manifest.json
devtools.html / devtools.js    创建 DevTools 面板
content-script.js              页面 ↔ 扩展桥接
panel.html / panel.css         面板壳
src/
  panel.tsx                    入口：createApp(DevtoolsPanel)
  PanelApp.tsx                 状态 / chrome bridge 编排
  types.ts
  format.ts
  layout/
    PanelHead.tsx              topbar：连接 / App / 操作
    PanelSidebar.tsx           侧栏
    PanelContent.tsx           主内容：Tabs + Tab 内容
  components/
    ComponentTree.tsx          递归组件树
    ComponentDetails.tsx       props/state/computed/Model
  tabs/
    PanelTabs.tsx              Tabs 导航
    ComponentsTab.tsx
    EventsTab.tsx
    PerformanceTab.tsx
build/panel.js                 构建产物（提交，供 unpacked 加载）
vite.config.ts                 面板构建配置
```

## 通信协议

```text
page  → content : window.postMessage
                  { source: 'actview-devtools-page', type, payload }
content → page : window.postMessage
                  { source: 'actview-devtools-content', type, payload }
panel → content : chrome.tabs.sendMessage
                  { source: 'actview-devtools-panel', type, payload }
content → panel : chrome.runtime.sendMessage（转发 page 消息）
```

消息类型：

- `connect` / `snapshot` / `refresh`
- `getState`
- `highlight` / `clearHighlight`
- `startPicker` / `stopPicker`
- `picked` / `picker-empty` / `picker-cancelled`

## 排查连接

面板顶部状态：

- `no content script; reload the extension and page`
  → 扩展 content script 未注入；在 `chrome://extensions` 重新加载扩展，并刷新页面。
- `extension injected; waiting for @actview/devtools`
  → content script 已注入，但页面没有安装 backend；确认 `app.use(devtoolsPlugin)` 且页面已重载。
- `connected`
  → 正常。

页面控制台可检查：

```js
window.__ACTVIEW_DEVTOOLS__ // { bridge: true, version: 1 }
document.documentElement.dataset.actviewDevtoolsContent // "1"
```

只有两个标记都存在，扩展 ↔ 页面链路才完整。

## 当前限制

- 无搜索框 / 依赖图 / 时间旅行 / 状态编辑；
- 无源码定位；
- 无多 frame；
- 需要页面安装 `@actview/devtools`；
- 扩展未打包发布，直接加载目录。
