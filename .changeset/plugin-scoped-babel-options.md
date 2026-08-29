---
'@actview/plugin-scoped': minor
---

actviewScopedPlugin 支持 babel 排除规则透传，继承宿主壳 node_modules 硬排除

- `actviewScopedPlugin({ babel?: BabelTransformOptions })`——include/exclude
  规则透传给 transformWithBabel（node_modules 硬排除，不可覆盖）。
- 行为变化：node_modules 下的 ?scoped JSX 不再注入 data-v-hash（CSS 侧不受
  影响，仍正常 scoped 化）；源码分发主题/库包（actpress 场景）需要注入时，
  在 vite config 里 alias 到包源码（路径脱离 node_modules 段）即可恢复。
- 测试更新：node_modules 硬排除断言（含 include 不可覆盖）+ alias 后形态
  恢复注入 + 两侧 hash 一致。
