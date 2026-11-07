# actview

## 4.0.2

### Patch Changes

- 726f1f5: 恢复 peerDependencies 的 `@actview/core` 范围为 `^1.0.0`（跟随宿主 1.x）
  
  上一轮 Version Packages 里，changesets 默认 `onlyUpdatePeerDependentsWhenOutOfRange:
  false`，只要被依赖包发了版就改写 peer 范围，把各包的 `@actview/core` 从 `^1.0.0`
  改成了 `^1.5.0`，与「core 破坏性变更才发 2.0，各库 peer 保持 `^1.0.0` 即可跟随宿主
  版本」的约定不符。
  
  - `.changeset/config.json` 开启 `onlyUpdatePeerDependentsWhenOutOfRange: true`，
    之后 core 在 1.x 内发版不再改写 peer 区间
  - 各运行时包 peer 范围改回 `^1.0.0`（本次 patch 发布会把修正后的范围带到 npm）

## 4.0.1

### Patch Changes

- 940f89e: 统一 peerDependencies 范围为 `^1.0.0`（core 破坏性变更须发 2.0）
  
  各运行时包对 `@actview/core` / `@actview/jsx` 的 peer 范围从 `^1.1.0` /
  `^1.3.0` 放宽为 `^1.0.0`——覆盖全部 1.x，保证宿主应用与所有库解析到同一份
  core 实例（模块级单例：currentInstance / targetMap / jobQueue / controlledEls），
  根治「双实例」导致的 context/provide 断链、响应式分裂（base-ui 440 根因）。
  
  约定：`@actview/core` 的破坏性变更必须发 2.0，各库 peer 范围保持 `^1.0.0` 即可
  跟随宿主版本。
- Updated dependencies [ce76f85]
  - @actview/core@1.5.0
