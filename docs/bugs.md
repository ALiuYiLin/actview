# Bugs 与已知限制

> 记录 PLAN.md 中尚未修复的问题 + 开发中确认的实际行为。
> 状态标记：🐛 未修复 bug ｜⚠️ 已知限制（设计取舍，非 bug）
> 所有条目均含复现与修复方向，便于排期。

---

## 一、未修复 Bug（🐛）

### 1. ✅ 已修复 — P0 `effect` 内修改数组爆栈（提交 c7e6c6e，verify 场景 17）

- **原问题**（已实测 `RangeError: Maximum call stack size exceeded`）：

  ```ts
  const state = reactive({ items: [1] })
  runEffect(() => {
    state.items.push(state.items.length) // effect 内修改自身依赖的数组
  })
  ```

- **原因**：数组 `push` 经代理 `set` 触发 `trigger` → 同步执行依赖它的 effect（`effect.run()`）→ 重跑时又 `push` → 无限同步递归。
- **修复**（`packages/core/src/runtime/reactive-system.ts` + `reactivity/reactive.ts`）：
  1. `pauseTracking() / resetTracking()`：数组修改方法（`push/pop/shift/unshift/splice/sort/reverse`）执行期间暂停依赖收集。
  2. `ReactiveEffect.run()` 重入保护（`_running` 标记）：effect 执行中再次被 trigger 直接跳过，不再同步递归。
  3. `run()` 内恢复 `shouldTrack`：effect 重跑是独立执行上下文，暂停期间嵌套触发的 effect 也能正常重新收集依赖。
- **验证**（verify 场景 17）：effect 内 push 不爆栈、恰好执行一次；其他依赖该数组的 effect 正常触发；组件渲染内 push 不崩。
- **遗留**：异步队列场景（组件 effect 内 push）仍有无限循环（与 Vue 3 相同），属「effect 内修改自身依赖」反模式，文档约束。

---

### 2. 🐛 P1 — 同索引 diff 无移动（无 key 列表增删中间项错位）

- **现状**：`patchChildren` 对无 key 列表按位置（同索引）对比 patch，中间插入/删除会使后续项全部错位。
- **复现**：

  ```tsx
  const state = reactive({ list: ['a', 'b', 'c'] })
  // <ul>{state.list.map(i => <li>{i}</li>)}</ul>  —— 无 key
  state.list = ['a', 'x', 'b', 'c'] // 插入 'x'：b/c 的文本虽会更新，但 DOM 节点错位
  ```

- **影响**：需配合 key 使用；无 key 时增删中间项 DOM 复用错乱（文本更新仍正确，但 DOM 引用/状态错位）。
- **修复方向**：无 key 列表也可走「索引 diff + 尾部锚点」或直接退化为「重建」（正确性优先）；参考 Vue 3：无 key 时按索引 patch，新增项插到末尾、多余旧项删除——**当前实现其实已按此逻辑，问题在于索引定位文本节点用 `childNodes[index]` 在增删时可能偏移**（见条目 3 同源）。

---

### 3. 🐛 P2 — Fragment 内文本索引偏移

- **现状**：Fragment 位于兄弟节点中间时，其内部文本节点更新按 **0 起始索引**从容器 `childNodes` 恢复，可能取到容器内**其他兄弟**的节点造成错位。
- **复现**：

  ```tsx
  // <div><span>A</span><>{state.n}</><span>B</span></div>
  // Fragment 内文本按 childNodes[0] 定位 → 拿到 <span>A</span> 而非 Fragment 的文本
  ```

- **原因**：`patchVNode` 文本分支 `container.childNodes[index]` 的 `index` 在 Fragment 内从 0 计数，与容器全局索引不一致。
- **修复方向**：Fragment patch 时携带正确的容器全局索引偏移，或文本 VNode 缓存真实 `el`（首次挂载后存 `vnode.el`，更新时直接复用而不按索引查）。

---

### 4. 🐛 P3 — 空文本节点残留

- **现状**（已实测）：子节点文本从有值变为 `''` 时，DOM 中残留空文本节点（`childNodes` 数量不变，`textContent` 为空）。
- **复现**：

  ```tsx
  const state = reactive({ s: 'abc' })
  // <div>{state.s}</div> → state.s = '' → div.childNodes 仍为 1（空文本节点）
  ```

- **影响**：小瑕疵，不影响显示；`childNodes` 遍历/样式选择器可能受扰。
- **修复方向**：patch 文本时若新文本为 `''` 且旧文本非空 → 直接 `removeChild` 并标记 vnode.el 为 null；下次非空时重新创建。

---

## 二、已知限制（⚠️ 设计取舍）

| 限制 | 说明 | 缓解/替代 |
|---|---|---|
| 无 key 列表 diff 错位 | 见 Bug 2 | 列表渲染务必加 `key` |
| `keep-alive` 子组件需单根元素 | Fragment 子组件 `subTree.el` 为 null，缓存/恢复无效 | 子组件返回单根元素 |
| `mounted` 钩子顺序：子先于父 | 同步挂载顺序，与 Vue 3（post 队列，父先子后）相反 | 依赖父先于子挂载的顺序场景需注意 |
| `watch` 不随组件卸载自动 stop | 无 scoped effects 机制 | 在 `onBeforeUnmount` 中调用 `watch` 返回的 stop |
| `ErrorBoundary` 捕获后不自动恢复 | 触发 fallback 后持续显示直到边界重建 | 用 key 重建边界 |
| `lazy` 的 loader 需返回组件产物 | 须为 `defineComponent` 产物（setup 返回 render 函数）；`import('./x')` 用 `m.default` | 见 verify 场景 15 用法 |
| `effect` 内修改自身依赖的数组 | 异步队列场景下会无限循环（与 Vue 3 相同，属反模式）；同步场景已修复不爆栈（见已修复 Bug 1） | 事件 handler 内修改 |
| 无具名插槽 | 仅默认/作用域插槽（函数 children） | 具名插槽需 JSX/Babel 侧语法支持 |
| 组件函数体顶层是 setup 体（只执行一次） | 顶层响应式读取/抛错不会在更新时重跑；渲染期逻辑应放 JSX 表达式 | 见 verify 场景 15 注释 |

---

## 三、已修复 Bug 索引（详见 PLAN.md 完成记录）

- 数组方法不响应（d413312）｜`for...in`/`in` 不响应（34a8729）｜Date/Map 代理崩溃、readonly/markRaw/shallowReactive（6f892fd）
- 受控 input 光标跳动（caa6931）｜无调度批处理/无 nextTick（53b4af6）
- keyed diff 整体重排非最小移动（LIS）｜事件系统 `el.on*` 简陋（invoker + capture）
- `replace` 不卸载旧组件导致实例泄漏（bffcfd8 顺带修复）｜patch 复用失效实例不重建（74a0bd4 顺带修复）
- **effect 内修改数组爆栈**（c7e6c6e：`pauseTracking` + `run()` 重入保护 + `shouldTrack` 恢复）
