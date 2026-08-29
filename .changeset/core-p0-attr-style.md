---
'@actview/core': minor
---

P0 属性/样式规范化修复（C7/C2/C11 + enumerated + class 合并）

- **C7**：stringifyStyle 与客户端 style 分支统一过滤 undefined/null/false 值——
  SSR 不再输出 `k:undefined` 字面量；客户端不再依赖 CSSOM 对 undefined 赋值的静默忽略。
- **C2**：数字样式补 px——非 0 数字 + 非 unitless + 非 CSS 变量 → `${v}px`
  （`width:1→1px`、`margin:-1→-1px`、`0`/`opacity`/`lineHeight`/`flex`/`--x` 不补），
  白名单照抄 React `isUnitlessNumber`；SSR 与客户端（CSSOM 原生补 px）两端一致。
- **C11**：布尔属性（checked/disabled/readonly）客户端补 attribute（与 SSR 裸属性对齐）
  + property 双写；false/null 分支重置 property（修 checked true→false 状态残留）；
  default*/value 分支语义保持。
- **enumerated 属性**（contenteditable/draggable/spellcheck）：true→"true"、
  false→"false" 不移除（对齐 React/Vue），两端一致。
- **class 合并**：新增 normalizeClass（字符串/数组/对象条件合并，对齐 Vue），
  SSR serializeAttrs 与客户端 className 双端复用（修复 SSR 数组输出 "a,b"）。
- 新增共享模块 `runtime/attr-utils.ts`（unitless 白名单/BOOLEAN_ATTRS/enumerated/
  normalizeStyleValue/normalizeClass）——setProp 与 serializeAttrs 同一套规则，
  根治「同一组件 SSR 与客户端输出不同」这一类缺陷的结构根因。
- 测试：test/platform-diff/attr-style.test.tsx（20 用例：过滤/px 边界/布尔 attribute/
  状态残留/enumerated/class 合并/两端一致）；dom-attr-mapping 的 spellCheck 断言
  更新为 enumerated 语义。
