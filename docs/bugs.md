# 已知限制与语义差异

> 记录当前实现与 Vue 3 的差距（未实现项）与设计取舍。已修复的 bug 记录见 git 历史，不再维护。

---

## 一、与 Vue 3 的语义差异（未实现）

> 来源：Vue 3 reactivity 官方用例迁移（`scripts/actview.test.tsx`，45 个核心用例）时跳过项。

- Map/Set/WeakMap/WeakSet 响应式代理
- `isReactive` / `isReadonly` / `isProxy` / `toRaw` 工具函数
- `shallowReadonly` / `shallowRef`
- `computed` setter（可写 computed）；`effectScope` 独立公开 API（内部有 EffectScope，未暴露全 API）
- `onWatcherCleanup` / `once` / `call` / `scheduler` 等 watch 选项
- 数组 identity 方法（`indexOf`/`includes` 对 reactive 元素的 toRaw 比较）
- ref 在 reactive 嵌套中的自动解包（Vue 3 有，我们无）

## 二、已知限制（设计取舍，非 bug）

| 限制 | 说明 |
|---|---|
| `<solid>` 块内 props 桥接 | 块内无 render 重跑，数据须闭包捕获外层 ref/reactive；父 re-render 的 props 变化传不进边界 |
| scoped CSS 文件级语义 | `import './x.css?scoped'` 为文件级注入：同文件所有组件都带 hash（跨文件组件不受影响）；`:slotted()` 仅同文件内有效（纯编译期无运行时 scope 传递） |
| attribute fallthrough 值类型过滤 | 透传仅 string/number/boolean/style 对象/on*；数组/函数/对象 props 不透传（显式事件优先） |
| 根字符串 style | 组件根元素显式 `style="..."` 字符串保留（不参与 merge） |
