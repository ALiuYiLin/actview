---
'@actview/core': minor
---

P1 属性决策统一：React 分组 switch 语义（resolveAttr 双端共用）+ xlink/xml 命名空间 + URL 清洗

- attr-utils 新增 `resolveAttr(key, value, tag)`：照抄 React `ReactDOMComponent.setProp`
  的分组决策（2026-08 快照）——plain / enumerated（Booleanish String）/
  boolean / overloaded（capture/download）/ 正数（cols/rows/size/span）/
  数字（rowSpan/start）/ URL（href/src/action/formAction/data[object]）/
  命名空间（xlink*/xml*）分组，客户端 setProp 与 SSR serializeAttrs 双端同一套。
- **xlink/xml 命名空间**：xlinkHref/xlinkActuate/.../xmlLang 等走
  `setAttributeNS`（此前普通 setAttribute，SVG 环境可能不生效）；xlink:href 额外 URL 清洗。
- **URL 清洗（sanitizeURL）**：href/src/action/formAction 命中
  `javascript:`（含 C0 控制符/空白/换行混淆变体，正则照抄 React）→ 替换为
  会抛错的 URL；空串语义：src="" 移除、`<a href="">` 保留。
- **行为变化（对齐 React）**：plain 属性（dir/role 等）布尔值不再输出空属性而移除；
  cols/rows/size/span 负数/0 移除；rowSpan/start 仅校验数字。
- **与 React 的有意偏离**（注释记录）：multiple/muted 走布尔 attribute 而非
  property coerce（保住 ActView 双端一致，浏览器 IDL 反射保行为）；autoFocus
  客户端保留 attribute（无 React 的 polyfill 架构）；checked/selected/autofocus/
  novalidate 补入布尔组（React 由受控 wrapper 处理）。
- JSX 类型：download 放宽为 string | boolean（overloaded）。
- 测试：test/platform-diff/attr-p1.test.tsx（11 用例：命名空间/URL 清洗/数值/
  overloaded/plain 布尔移除/布尔补充键/双端一致）；全量 562 用例通过。
