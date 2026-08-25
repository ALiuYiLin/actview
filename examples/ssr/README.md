# ActView SSR Demo

演示 actview 的 SSR + 客户端水合：**服务端渲染 HTML → 客户端 hydrate 复用 DOM（无闪烁、无重建、事件即用）**。

## 技术栈

- `renderToStringAsync`：服务端渲染（async 版，支持 await 组件内 `onServerPrefetch`）
- `hydrate`：客户端水合（游标配对模型，复用既有 DOM）
- 预取数据模式：服务端 `fetchPosts()` → `window.__INITIAL_DATA__` 注入 → 客户端 hydrate 传 props → 两端首帧一致
- 构建：tsup（服务端 Node ESM + 客户端浏览器 IIFE），JSX 经 `@actview/jsx` runtime（裸函数组件运行时兜底，无需 babel 插件）

## 运行

```bash
cd examples/ssr
npm run dev        # build + start
# 或分步：
npm run build
npm start
```

浏览器打开 http://localhost:3100 （可用环境变量覆盖：`PORT=8080 npm start`）。

## 验证点

1. **首屏 = 服务端 HTML**：查看网页源码，列表内容在 `#app` 内（服务端已渲染）
2. **水合无重建**：打开 DevTools → Elements，确认水合后 DOM 与 SSR 输出一致（`data-uid` 属性两端相同）
3. **事件即用**：点击 `+1`，计数立即更新（patch 路径，非整页刷新）

## 目录结构

```
examples/ssr/
├── src/
│   ├── App.tsx            # 演示组件（计数器 + useId + 预取数据列表）
│   ├── entry-server.ts    # Node http 服务：预取 → renderToStringAsync → 页面
│   ├── entry-client.tsx   # 客户端水合入口（hydrate + __INITIAL_DATA__）
│   └── data.ts            # 模拟数据获取（真实场景接 DB/API）
├── tsup.config.ts         # 双目标构建（node ESM / browser IIFE）
└── tsconfig.json          # jsx: react-jsx + jsxImportSource: @actview/jsx
```
