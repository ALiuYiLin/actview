# 开发计划 — 已知限制与后续方向

> 规划来源：`docs/DESIGN.md` 第 9 节 + 开发过程中的实际踩点。
> 本文件随实现进度更新：完成项标记 ✅。

---

## 一、数据层（响应式）

| 限制 | 现状 | 影响 | 优先级 |
|---|---|---|---|
| **数组方法不响应** | `reactive` 只拦 `get/set/deleteProperty`，`push/splice/reverse` 等走内部索引+length，而 render 只 track `items` 这个 key | 高频痛点：只能 `state.items = [...]` 替换整数组 | P0 |
| **无 `computed` / `watch`** | 只有 `reactive` + `runEffect`（可当手动 watch） | 无派生值缓存、无便捷侦听封装 | P1 |
| **无 `ref`** | 基本类型无法直接响应（只能包对象） | 使用体验 | P1 |
| **`for...in` / `'in'` 不响应** | Proxy 缺 `has` / `ownKeys` 陷阱 | 遍历响应式对象不更新 | P2 |
| **无调度批处理** | `trigger` 同步执行，一轮内改 N 次状态跑 N 次 effect | 性能 + 无 nextTick 语义 | P1 |
| **无 `shallowReactive` / `readonly` / `markRaw`** | 只有深度 reactive | 灵活性/性能边界 | P2 |

## 二、渲染层（diff）

| 限制 | 现状 | 影响 | 优先级 |
|---|---|---|---|
| **keyed diff 非最小移动** | 「复用 + 整体 appendChild 重排」，非 LIS 最长递增子序列 | 大列表重排 O(n) DOM 移动 | P1 |
| **同索引 diff 无移动** | 无 key 列表按位置对比，增删中间项会错位 | 需配合 key 使用 | P1 |
| **受控 input 光标跳动** | 每次 patch 重设 `el.value` | 输入体验 | P0 |
| **事件系统简陋** | `el.on*` 赋值，无 `addEventListener`、无 capture、无统一解绑 | 复杂交互受限 | P2 |
| **Fragment 内文本索引偏移** | Fragment 处于兄弟节点中间时文本更新按 0 起始索引，可能错位 | 边缘场景 | P2 |
| **空文本节点** | `{fn()}` 返回 `''` 会残留空文本节点 | 小瑕疵 | P3 |

## 三、组件能力

| 限制 | 现状 | 优先级 |
|---|---|---|
| **无生命周期钩子** | 无 `onMounted`/`onBeforeUnmount` 等；卸载时只有 effect 停止，外部资源（事件、定时器、订阅）无清理钩子 | P0 |
| **无插槽体系** | `props.children` 可透传，但无具名/作用域插槽 | P2 |
| **无动态组件 / keep-alive** | `<component is>`、缓存组件未实现 | P2 |
| **无错误边界 / Suspense** | 组件渲染抛错无兜底 | P2 |
| **`ref` 字段闲置** | VNode.ref 已留字段未实现模板引用 | P2 |
| **无异步组件** | 无 lazy 加载 | P3 |

## 四、工程化

| 限制 | 现状 | 优先级 |
|---|---|---|
| **测试是自制 stub** | `scripts/verify.mjs` 手写 DOM stub，非标准测试框架 | P1 |
| **类型未泛型化** | 组件 props 无泛型推导、事件类型手工定义 | P2 |
| **无 devtools** | 无调试面板 | P3 |
| **无 SSR/hydration** | 渲染器直接依赖 `document` | P3 |
| **无文档站点** | 仅 `docs/DESIGN.md` + `docs/test.md` | P3 |

---

## 路线图（按投入产出排序）

### 阶段一：补常用短板（P0）

1. **数组方法 instrumentation**（`push/pop/shift/unshift/splice/sort/reverse`）
   - 参考 Vue 3 `arrayInstrumentations`：用 Proxy 拦截数组方法，patch 后手动触发依赖
   - 完成后 demo 可改为 `state.items.push(...)`，verify 增加数组方法场景
2. **受控 input 光标保位**
   - patch 更新 `value` 前记录 `selectionStart/End`，更新后恢复
3. **生命周期钩子**（`onMounted` / `onUpdated` / `onBeforeUnmount`）
   - 模块级 `currentInstance` 上下文 + `ComponentInstance` 挂钩子数组
   - 配合「卸载时清理事件/定时器」解决资源泄漏
4. **computed + ref**
   - `computed`：基于 effect + 脏标记缓存
   - `ref`：`{ value }` 对象包装，`ref.value` 响应式

### 阶段二：正确性与性能（P1）

5. **调度批处理**：effect 更新入微任务队列去重（scheduler + job queue），提供 `nextTick`
6. **LIS 最小移动 diff**：替换「整体重排」为最长递增子序列定位不动节点
7. **`has` / `ownKeys` 陷阱**：支持 `for...in` / `key in obj` 响应

### 阶段三：能力扩展（P2）

8. 事件系统升级：`addEventListener` + capture + 统一解绑
9. 插槽、动态组件、keep-alive
10. 错误边界 / Suspense

### 阶段四：工程化（P2-P3）

11. 测试迁移到 **vitest + happy-dom**（verify.mjs 的 stub 换掉，场景保留为用例）
12. 类型泛型化：`defineComponent<T>` props 推导、事件类型生成
13. devtools / SSR（远期）

---

## 完成记录

| 日期 | 项 | 说明 |
|---|---|---|
| - | - | 尚未开始 |
