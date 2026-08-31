---
"@actview/plugin-vite": minor
---

`actviewJsxPlugin` 新增 `pluginOptions` 选项：透传给 @actview/plugin-jsx（`autoDefineComponent` / `createVNodeSource` 等）——例如 v1 形态组件库（显式 `defineComponent` + setup 返回 render 闭包）可用 `autoDefineComponent: false` 跳过自动包装/非法形态检查与 props 声明注入
