---
'actview': patch
'@actview/router': patch
'@actview/store': patch
'@actview/testing': patch
'@actview/hooks-react': patch
'@actview/devtools': patch
---

恢复 peerDependencies 的 `@actview/core` 范围为 `^1.0.0`（跟随宿主 1.x）

上一轮 Version Packages 里，changesets 默认 `onlyUpdatePeerDependentsWhenOutOfRange:
false`，只要被依赖包发了版就改写 peer 范围，把各包的 `@actview/core` 从 `^1.0.0`
改成了 `^1.5.0`，与「core 破坏性变更才发 2.0，各库 peer 保持 `^1.0.0` 即可跟随宿主
版本」的约定不符。

- `.changeset/config.json` 开启 `onlyUpdatePeerDependentsWhenOutOfRange: true`，
  之后 core 在 1.x 内发版不再改写 peer 区间
- 各运行时包 peer 范围改回 `^1.0.0`（本次 patch 发布会把修正后的范围带到 npm）
