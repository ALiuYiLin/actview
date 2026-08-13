# 已知限制与语义差异（当前状态）

> 记录当前实现与 Vue 3 / React 的差距（未实现项）与设计取舍。

---

## 一、设计取舍（明确不做）

| 项 | 决策 |
|---|---|
| ref 在 reactive 嵌套自动解包 | ❌ 不做，保持显式 `.value` |
| `customRef` | ❌ 砍（精简路线） |
| 表单双向绑定（v-model） | ❌ 砍，`value + onInput` 数据流更清晰 |
| 合成事件（SyntheticEvent） | ❌ 砍，原生事件直连 |
| 事件修饰符 `once` | ❌ 砍，可用闭包实现 |
| watch 的 `onTrack`/`onTrigger` | ❌ 砍，`onRenderTracked`/`onRenderTriggered` 替代 |
| Options API / props 校验 / `emits` | ❌ 砍，TSX + TS 类型 + 回调 props 替代 |

---

## 二、已知限制（设计取舍，非 bug）

| 限制 | 说明 |
|---|---|
| `<solid>` 块内 props 桥接 | 块内无 render 重跑，数据须闭包捕获外层 ref/reactive；父 re-render 的 props 变化传不进边界 |
| scoped CSS 文件级语义 | `import './x.css?scoped'` 为文件级注入：同文件所有组件都带 hash；`:slotted()` 仅同文件内有效 |
| 组合式 state 不暴露 | 组件 state 是 setup 闭包变量，DevTools 无法直接读（用响应式事件流替代） |
| 无 SSR / hydration | `renderToString` 仅静态序列化，无水合（计划中，见 `gap-analysis.md` 第四节） |
| 组件卸载 API | `createApp` 无 `unmount`（测试工具用 `container.remove()` 兜底） |

---

## 三、已解决的语义差异（历史）

> 以下曾是与 Vue 3 的差距，已在 P0/P1 补齐：`Map`/`Set`/`WeakMap`/`WeakSet` 代理、`toRaw`/`isReactive`/`isReadonly`/`isProxy`/`isShallow`、`shallowRef`/`shallowReadonly`/`triggerRef`、`computed` setter、`effectScope`/`onScopeDispose`、`onWatcherCleanup`、`watch` 的 `flush`/`deep`/`once`、数组 identity 方法、`toValue`、SVG 渲染、`dangerouslySetInnerHTML`、事件 `passive`。
