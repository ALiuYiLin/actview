---
'@actview/plugin-jsx': patch
---

补 tsup.config.ts：修复 prepublishOnly 构建失败（`No input files`）

fork 自 @vue/babel-plugin-jsx 时漏建 tsup 配置（entry/format/dts/outDir），
`pnpm build`（prepublishOnly）报 `No input files` 导致发布中断。
已补 `plugins/jsx/tsup.config.ts`（与其他包一致：entry src/index.ts、
ESM、dts、clean），本地验证构建产物正常。
