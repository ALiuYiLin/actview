---
'@actview/core': minor
---

渲染器 patch 阶段对齐 Vue：getNextHostNode + 锚点贯穿 + lazy 占位 + Fragment 位置

（docs/vue-patch-render-comparison.md 的 P-A/P-B/P-C 路线落地）

- **getNextHostNode**（对齐 Vue renderer.ts:2403）：按 vnode 类型递归求「子树
  结束后的下一个兄弟」——组件→subTree、Fragment→末尾子 DOM、**Teleport→跳过**
  （内容在 target，不参与 nextSibling 搜索，对齐 #9071/#9313）；replace 与
  组件更新统一使用（替代手写 collectDomEls 锚点）。
- **getNextHostNode Fragment 分支跳过 Teleport**：Fragment 末尾为 Teleport 时
  collectDomEls 会取到 target 容器（body）里的 DOM 作 anchor——jsdom/真实
  浏览器 insertBefore 抛 NotFoundError → 组件更新中断（props 不响应 /
  provide 断链）。修复：遍历 __avChildren 时跳过 __builtin==='teleport'
  （base-ui FloatingPortal 场景；复现 test/renderer/teleport-anchor-repro.test.tsx）。
- **sameIndexAnchor 归属校验**：同索引 diff 挂载锚点只取「仍在本容器内」的
  旧 DOM（container.contains）——旧节点已卸载/跨容器（Teleport/keep-alive/
  过滤列表）时取容器外 DOM 会抛 NotFoundError（useListNavigation 场景）。
- **组件更新锚点重算**（对齐 Vue :1544-1554）：oldSubTree 非 null 时每次
  getNextHostNode(oldSubTree)；删除补丁式 nextSiblingVnode/firstDomEl。
- **lazy placeholder**：lazy 未加载时渲染零宽空格占位文本节点（对齐 Vue
  resolveAsyncComponentPlaceholder）——列表 diff/锚点/SSR/hydrate 有稳定节点
  可定位（此前渲染 null 无 DOM）。
- **Fragment 结束位置**：Fragment children 的挂载/追加锚点由 patch 链传入
  （同列表该项之后的位置），不引入额外锚点节点（避免打破 childNodes 索引
  假设——slots/keyed 回归教训）；replace 对无 DOM 旧子树（空 Fragment）
  fallback patch 链锚点。
- **unmount 删除 childNodes[index] 兜底**：vnode 索引 ≠ DOM 索引，该兜底在
  Fragment 无 DOM 时会误删后续兄弟（[frag(null), b] 替换 frag 时删掉 b）；
  文本 vnode 有持久 el 已由 collectDomEls 覆盖。
- 测试：test/renderer/fragment-anchor.test.tsx（4 用例：空 Fragment 替换/
  嵌套混排/Fragment 增长/卸载无残留）；same-index-anchor-regression 验证
  用例（Teleport/动态列表/卸载重挂）；全量 592 用例通过。
