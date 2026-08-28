---
'@actview/router': patch
---

修复 matcher 前缀遮蔽：多段路径被同名前缀路由吞掉，matched=[] 导致 RouterView 渲染 null（页面空白）

- matchPath 中某条记录前缀命中但剩余段未消费时，旧代码直接 `return null`，
  不再尝试后续记录。`/a` 注册在 `/a/b` 之前时 `/a/b` 永远匹配不到
  （当前路由校验页 `/react-migration` 索引 + `/react-migration/use-state` 子页即触发）。
- 修复：两处 `return null` 改为 `continue`（继续尝试后续记录，首个完整命中即返回）；
  children 分支同理——父 children 全未命中且剩余段非空时也继续尝试后续记录。
- 单段路由、嵌套 children、未注册路径语义不变；
  补回归测试：前缀遮蔽命中 + RouterView 渲染切换（test/router/router.test.tsx）。
