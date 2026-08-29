---
'@actview/core': patch
---

fix(core): resolveAttr 布尔组查询兼容 camelCase prop（autoFocus → autofocus）

BOOLEAN_GROUP 混合 camelCase（allowFullScreen/autoPlay）与小写键
（autofocus/checked/selected）。resolveAttr 分组查询只查原始 key，
camelCase autoFocus 命中小写 autofocus 失败 → 落入 resolvePlainAttr
被 boolean 移除（1.4.0 回归：React 的 autoFocus prop 不渲染 attribute，
依赖 [autofocus] 的 FloatingFocusManager 初始聚焦失效）。

修复：分组查询同时检查 key 与 HTML_ATTR_OVERRIDES 规范化名 name。
回归用例：test/platform-diff/attr-p1.test.tsx 新增 autoFocus 双端布尔属性。
