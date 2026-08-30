---
'@actview/core': patch
---

修复同索引 diff 挂载位置：null 空位与 lazy 组件加载后的兄弟顺序

- **缺陷 1**：patchChildren 同索引 diff 中，旧列表含 null 空位（条件渲染占位）
  时（如 [null, button, null] → 新 [g, button, g]），新节点走 patch 的
  mountVNode 无 anchor 分支 → append 到容器末尾，兄弟顺序错误
  （DOM 变 [button, g, g] 而非 [g, button, g]）。
- **缺陷 2**：lazy 组件首次渲染 null 占位、加载完成后 subtree 从 null → 实节点，
  组件更新挂载无锚点 → append 末尾（[lazy, div, lazy] 渲染成 [div, lazy, lazy]）。
- 修复：
  - 同索引 diff 循环内联挂载分支，anchor 用 sameIndexAnchor（「旧列表 i 之后
    第一个有真实 DOM 的节点」，firstDomEl 处理 Fragment 多 DOM）；
    **不能用 container.childNodes[index]**——Fragment 递归挂载/文本混排时
    childNodes 索引与 vnode 索引不对齐（Bug 3 回归）。
  - mountComponent 接收 anchor（组件首次渲染 subtree 用其定位）+ nextSiblingVnode
    （lazy 加载完成 subtree 挂载时用后兄弟 DOM 延迟求值作锚点）；renderer
    注入 firstDomEl。patch/mountVNode 签名扩展 anchor/nextSiblingVnode 透传。
- 测试：test/renderer/same-index-mount.test.tsx（4 用例：两端空位变实节点、
  头部插入、lazy 同索引 [lazy,div,lazy]、lazy keyed 列表）；keyed-diff Bug 3
  回归验证；全量 583 用例通过。
