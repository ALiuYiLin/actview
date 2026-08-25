# ActView SSR Demo

演示 actview 的 SSR + 客户端水合：**服务端渲染 HTML → 客户端 hydrate 复用 DOM（无闪烁、无重建、事件即用）**。

## 技术栈

- `renderToStringAsync`：服务端渲染（async 版，支持 await 组件内 `onServerPrefetch`）
- `hydrate`：客户端水合（游标配对模型，复用既有 DOM）
- **组件正确写法**：简写组件（`function App() { return <div/> }`）→ `@actview/plugin-vite`（enforce pre）过 Babel 的 `defineComponentPlugin` 转换为 `defineComponent(fn, name)` + 注入 jsx runtime import——两端产物（client/SSR）都是转换后的形态，不经运行时兜底
- 预取数据模式：服务端 `fetchPosts()` → `window.__INITIAL_DATA__` 注入 → 客户端 hydrate 传 props → 两端首帧一致
- 构建：vite 双构建——`vite build`（客户端，index.html + assets）+ `vite build --ssr`（服务端 Node ESM，`ssr.noExternal` 内联 actview 源码包）

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
2. **defineComponent 转换**：`dist-server/entry-server.js` 中可见 `defineComponent(function(props) { ... return () => jsx(...) })`——App 已被 Babel 插件转换
3. **水合无重建**：打开 DevTools → Elements，确认水合后 DOM 与 SSR 输出一致（`data-uid` 属性两端相同）
4. **事件即用**：点击 `+1`，计数立即更新（patch 路径，非整页刷新）

## 目录结构

```
examples/ssr/
├── index.html              # 客户端入口模板（vite build 产出 dist/）
├── src/
│   ├── App.tsx             # 简写组件（计数器 + useId + 预取数据列表，插件转 defineComponent）
│   ├── main.tsx            # 客户端水合入口（hydrate + __INITIAL_DATA__）
│   ├── entry-server.tsx    # Node http 服务：预取 → renderToStringAsync → 模板注入
│   └── data.ts             # 模拟数据获取（真实场景接 DB/API）
├── vite.config.ts          # actviewPlugin + jsxImportSource + ssr.noExternal
└── tsconfig.json           # jsx: react-jsx + jsxImportSource: @actview/jsx
```
