---
'@actview/plugin-babel': minor
---

宿主壳硬排除 node_modules 下的转换 + include/exclude 规则

- node_modules 下的文件**硬排除**（返回 null 不转换），任何 include 规则不可覆盖：
  依赖是第三方代码，属依赖管线（esbuild 预构建），不是源码管线——
  babel-loader / @rollup/plugin-babel 同款默认，可显著加速 dev 冷启动。
- `createBabelTransform(plugin, options?)` 与 `transformWithBabel(code, filename, item, options?)`
  新增 `BabelTransformOptions`：`include`（白名单，node_modules 硬排除优先）/
  `exclude`（黑名单，优先于 include）。
- 源码分发库包/主题包需要现场编译时，不提供 opt-out 逃生门；在 vite/rollup
  config 里做路径转换——alias 到包源码 + optimizeDeps.exclude，使文件路径
  脱离 node_modules 段，即自然进入源码管线正常转换。
- 新增导出：`isExcludedTransform(filename, options?)` 判定助手；测试
  plugins/babel/test/babel-host.test.ts（7 用例：硬排除/路径形态/include 不可
  覆盖/alias 后形态/黑白名单）。
- 行为变化：plugin-vite / plugin-scoped 经宿主壳自动继承（node_modules 下的
  .tsx/.ts/.js 不再转换）。
