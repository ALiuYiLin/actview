---
'@actview/plugin-vite': minor
---

actviewPlugin 支持 babel 排除规则透传，继承宿主壳 node_modules 硬排除

- `actviewPlugin(options?: { babel?: BabelTransformOptions })`——include/exclude
  规则透传给 createBabelTransform（node_modules 硬排除，不可覆盖）。
- 行为变化：node_modules 下的 .tsx/.ts/.js 不再转换；源码分发库包需要现场
  编译时，在 vite config 里 alias 到包源码 + optimizeDeps.exclude（路径脱离
  node_modules 段）。
- 转换器创建移入 actviewPlugin() 内（原模块级单例），ConfigItem 仍只创建一次。
