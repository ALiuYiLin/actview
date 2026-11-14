# @actview/vitepress

基于 VitePress 源码改造的 ActView 文档站工具。

- 上游基线：`vitepress@2.0.0-alpha.17`（MIT）
- 当前状态：源码基线已导入，尚未接入 workspace / 构建
- 迁移方案：[MIGRATION.md](./MIGRATION.md)

## 目录

```text
src/                  上游 src 原样导入（迁移参考）
LICENSE.vitepress     上游 MIT 许可证
MIGRATION.md          架构与分阶段迁移方案
```

## 下一步

Phase 1 纵向切片：

```text
guide.md → markdownToActview → ActView Page → htmlToVNode → 最小 Layout
```

在此切片验证前，不批量改写 `src/client/theme-default` 下的 Vue 组件。
