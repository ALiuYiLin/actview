---
'actview': patch
'@actview/core': patch
'@actview/devtools': patch
'@actview/hooks-react': patch
'@actview/jsx': patch
'@actview/router': patch
'@actview/store': patch
'@actview/testing': patch
'@actview/plugin-babel': patch
'@actview/plugin-scoped': patch
'@actview/plugin-vite': patch
---

更新 npm 包元数据中的 GitHub 仓库地址。

仓库已从个人账号迁移到 `actview` 组织：重新发布后，各包 `package.json` 的
`repository.url` 变为 `https://github.com/actview/actview`（原为
`ALiuYiLin/actview`），同时 npm provenance 也会指向新仓库。

本次发布只包含元数据/仓库地址修正，无 API 变更。
