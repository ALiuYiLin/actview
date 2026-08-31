---
"@actview/plugin-babel": minor
---

`createBabelItem` 支持插件选项：新增可选第二参 `pluginOptions`——非空时按 Babel 标准 `[plugin, options]` 元组创建 ConfigItem（`createConfigItemSync([plugin, options])`），使宿主插件可以给目标 Babel 插件传配置（如 `autoDefineComponent` / `createVNodeSource`）；缺省行为不变
