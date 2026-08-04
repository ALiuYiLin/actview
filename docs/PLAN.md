# 开发计划 — 已知限制与后续方向

> 规划来源：`docs/DESIGN.md` 第 9 节 + 开发过程中的实际踩点。
> 本文件随实现进度更新：完成项标记 ✅。

---

## 一、数据层（响应式）

| 限制 | 现状 | 影响 | 优先级 |
|---|---|---|---|
| ~~**数组方法不响应**~~ | ✅ 已修复：惰性深层代理 + 数组 instrumentation（`push/pop/shift/unshift/splice/sort/reverse` 及索引赋值均触发更新） | 高频痛点 | ~~P0~~ ✅ |
| **无 `computed` / `watch`** | 只有 `reactive` + `runEffect`（可当手动 watch） | 无派生值缓存、无便捷侦听封装 | P1 |
| **无 `ref`** | 基本类型无法直接响应（只能包对象） | 使用体验 | P1 |
| ~~**`for...in` / `'in'` 不响应**~~ | ✅ 已修复：`has` / `ownKeys` 陷阱 + `ITERATE_KEY` 依赖，增删 key 触发更新 | 遍历响应式对象不更新 | ~~P2~~ ✅ |
| ~~**无调度批处理**~~ | ✅ 已实现：effect 更新入微任务队列去重（`queueJob` + Set 去重 + 批量 flush），提供 `nextTick` | 性能 + nextTick 语义 | ~~P1~~ ✅ |
| ~~**无 `shallowReactive` / `readonly` / `markRaw`**~~ | ✅ 已实现：只代理普通对象/数组（Date/Map/Set 等不代理）、`markRaw` 跳过代理、`readonly` 深层只读、`shallowReactive` 浅层 | 灵活性/性能边界 | ~~P2~~ ✅ |

## 二、渲染层（diff）

| 限制 | 现状 | 影响 | 优先级 |
|---|---|---|---|
| ~~**keyed diff 非最小移动**~~ | ✅ 已实现：LIS 最长递增子序列定位不动节点，仅移动非 LIS 节点（参考 Vue 3 `getSequence`） | 大列表重排 O(n) DOM 移动 | ~~P1~~ ✅ |
| **同索引 diff 无移动** | 无 key 列表按位置对比，增删中间项会错位 | 需配合 key 使用 | P1 |
| ~~**受控 input 光标跳动**~~ | ✅ 已修复：`setInputValue` 更新 value 前后记录/恢复 `selectionStart/End`（仅聚焦时） | 输入体验 | ~~P0~~ ✅ |
| ~~**事件系统简陋**~~ | ✅ 已升级：`addEventListener` + capture（`onClickCapture`）+ invoker 统一解绑（参考 Vue 3 `patchEvent`），换 handler 不重绑 | 复杂交互受限 | ~~P2~~ ✅ |
| **Fragment 内文本索引偏移** | Fragment 处于兄弟节点中间时文本更新按 0 起始索引，可能错位 | 边缘场景 | P2 |
| **空文本节点** | `{fn()}` 返回 `''` 会残留空文本节点 | 小瑕疵 | P3 |

## 三、组件能力

| 限制 | 现状 | 优先级 |
|---|---|---|
| ~~**无生命周期钩子**~~ | ✅ 已实现：`onMounted` / `onUpdated` / `onBeforeUnmount`（模块级 `currentInstance` 上下文），卸载时执行清理钩子 | 外部资源（事件、定时器、订阅）无清理钩子 | ~~P0~~ ✅ |
| ~~**无插槽体系**~~ | ✅ 已支持：默认插槽（`props.children` 静态透传）+ 作用域插槽（函数 children，render-prop 模式）；具名插槽未实现 | 内容分发 | ~~P2~~ ✅ |
| ~~**无动态组件 / keep-alive**~~ | ✅ 已实现：`<component is={...}>`（renderer 解析 props.is）；`KeepAlive` 缓存实例与 DOM（隐藏容器 + 卸载拦截 + 复用） | 动态切换 / 状态保留 | ~~P2~~ ✅ |
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

1. ~~**数组方法 instrumentation**~~ ✅（提交 d413312，verify 场景 6）
   - 已实现：惰性深层代理 + 数组代理 instrumentation，修改方法以代理为 this 调原始实现，length/索引/父级 key 依赖经 set 陷阱自动触发
   - 说明：未实现 `pauseTracking`（仅影响「effect 内改数组」的边界场景，事件 handler 场景不受影响）
2. ~~**受控 input 光标保位**~~ ✅（提交 caa6931，verify 场景 9）
   - 已实现：`setInputValue` 赋值前记录、赋值后恢复 `selectionStart/End`
3. ~~**生命周期钩子**~~ ✅（本次提交，verify 场景 12）
   - 已实现：`onMounted` / `onUpdated` / `onBeforeUnmount`；模块级 `currentInstance` 上下文，setup 执行期间注册钩子
   - 触发时机：首次渲染后 mounted（子先于父，同步挂载）；每次重渲染 updated；卸载前 beforeUnmount
4. ~~**computed + ref + watch**~~ ✅（本次提交，verify 场景 13）
   - `computed`：基于 effect + 脏标记的惰性缓存计算值，computed 本身也是依赖源
   - `ref`：`{ value }` 包装，`ref.value` 响应式；附 `isRef` / `unref`
   - `watch`：源可为 ref / getter / 对象（深遍历）/ 数组；`immediate`；回调 `onCleanup` 清理；返回 stop 函数

### 阶段二：正确性与性能（P1）

5. ~~**调度批处理**~~ ✅：effect 更新入微任务队列去重（scheduler + job queue），提供 `nextTick`
6. ~~**LIS 最小移动 diff**~~ ✅：替换「整体重排」为最长递增子序列定位不动节点
7. ~~**`has` / `ownKeys` 陷阱**~~ ✅（提交 34a8729，verify 场景 7）
   - 已实现：`ITERATE_KEY` + `has`/`ownKeys` 陷阱，新增/删除 key 触发迭代依赖

### 阶段三：能力扩展（P2）

8. ~~**事件系统升级**~~ ✅：`addEventListener` + capture + 统一解绑（invoker 模式）
9. ~~**插槽、动态组件、keep-alive**~~ ✅（本次提交，verify 场景 14）
   - 插槽：默认插槽（children 透传）+ 作用域插槽（函数 children）；具名插槽待定
   - 动态组件：`<component is={Comp}>`，renderer `resolveDynamicVNode` 解析 props.is
   - keep-alive：`KeepAlive` 内置组件（隐藏容器缓存 DOM + 实例保留），patch 复用分支 `newVnode.component` 优先
   - 顺带修复：`replace` 原不调用 `unmount`（组件替换时旧实例泄漏），现先卸载再挂载
10. 错误边界 / Suspense

### 阶段四：工程化（P2-P3）

11. 测试迁移到 **vitest + happy-dom**（verify.mjs 的 stub 换掉，场景保留为用例）
12. 类型泛型化：`defineComponent<T>` props 推导、事件类型生成
13. devtools / SSR（远期）

---

## 完成记录

| 日期 | 项 | 说明 |
|---|---|---|
| 提交 d413312 | 数组方法 instrumentation | 惰性深层代理 + 数组代理；`push/pop/shift/unshift/splice/sort/reverse` 与索引赋值触发更新；verify 场景 6 |
| 提交 34a8729 | for...in / 'in' 响应 | `ITERATE_KEY` + `has`/`ownKeys` 陷阱，增删 key 触发；verify 场景 7 |
| 提交 6f892fd | markRaw / readonly / shallowReactive | 只代理普通对象/数组（Date/Map/Set 不代理）；verify 场景 8 |
| 提交 caa6931 | 受控 input 光标保位 | `setInputValue` 记录/恢复 `selectionStart/End`；verify 场景 9 |
| 提交 53b4af6 | 调度批处理 + nextTick | `queueJob` 微任务去重；`ReactiveEffect.scheduler/active`；`nextTick(cb?)`；verify 场景 10 |
| 本次提交 | LIS 最小移动 diff | `getSequence`（贪心+二分+前驱回溯）定位不动节点，仅移动非 LIS 节点；verify 场景 2 增强（insertBefore 次数断言） |
| 本次提交 | 事件系统升级 | `patchEvent` + invoker 缓存（`el._vei`）；`onClickCapture` 支持 capture；handler 更新不重绑、null 解绑；verify 场景 11 |
| 本次提交 | 生命周期钩子 + computed/ref/watch | `onMounted`/`onUpdated`/`onBeforeUnmount`（currentInstance 上下文）；`computed`（脏标记惰性缓存）；`ref`/`isRef`/`unref`；`watch`（immediate/cleanup/stop）；verify 场景 12、13 |
| 本次提交 | 插槽 / 动态组件 / keep-alive | 默认+作用域插槽；`<component is>`；`KeepAlive`（隐藏容器缓存 + 实例复用）；修复 replace 不卸载旧组件的泄漏；verify 场景 14 |
