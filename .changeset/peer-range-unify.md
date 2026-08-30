---
'actview': patch
'@actview/router': patch
'@actview/store': patch
'@actview/testing': patch
'@actview/hooks-react': patch
'@actview/devtools': patch
---

统一 peerDependencies 范围为 `^1.0.0`（core 破坏性变更须发 2.0）

各运行时包对 `@actview/core` / `@actview/jsx` 的 peer 范围从 `^1.1.0` /
`^1.3.0` 放宽为 `^1.0.0`——覆盖全部 1.x，保证宿主应用与所有库解析到同一份
core 实例（模块级单例：currentInstance / targetMap / jobQueue / controlledEls），
根治「双实例」导致的 context/provide 断链、响应式分裂（base-ui 440 根因）。

约定：`@actview/core` 的破坏性变更必须发 2.0，各库 peer 范围保持 `^1.0.0` 即可
跟随宿主版本。
