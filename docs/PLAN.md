# 开发计划 — 已知限制与后续方向

> 规划来源：`docs/DESIGN.md` 第 9 节 + 开发过程中的实际踩点。
> 本文件随实现进度更新：完成项标记 ✅。
> 未修复问题与已知限制清单：见 `docs/bugs.md`。

---

## 一、数据层（响应式）

| 限制 | 现状 | 影响 | 优先级 |
|---|---|---|---|
| ~~**数组方法不响应**~~ | ✅ 已修复：惰性深层代理 + 数组 instrumentation（`push/pop/shift/unshift/splice/sort/reverse` 及索引赋值均触发更新） | 高频痛点 | ~~P0~~ ✅ |
| ~~**无 `computed` / `watch`**~~ | ✅ 已实现：`computed`（脏标记惰性缓存）；`watch`（源为 ref/getter/对象深遍历/数组，`immediate`、`onCleanup`、返回 stop） | 无派生值缓存、无便捷侦听封装 | ~~P1~~ ✅ |
| ~~**无 `ref`**~~ | ✅ 已实现：`{ value }` 包装，`ref.value` 响应式（对象值自动 reactive）；附 `isRef` / `unref` | 基本类型无法直接响应 | ~~P1~~ ✅ |
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
| ~~**无错误边界 / Suspense**~~ | ✅ 已实现：`ErrorBoundary`（栈式注册 + 渲染 try/catch + fallback）；`Suspense` + `lazy`（异步组件，fallback/resolve） | 组件渲染抛错无兜底 | ~~P2~~ ✅ |
| ~~**`ref` 字段闲置**~~ | ✅ 已实现：`props.ref`（函数或 `{ value }`）挂载时指向 DOM/组件实例，卸载时置 null | 模板引用 | ~~P2~~ ✅ |
| ~~**无异步组件**~~ | ✅ 已实现：`lazy(loader)` 异步加载组件（配合 Suspense，加载失败交给错误边界） | lazy 加载 | ~~P3~~ ✅ |

## 四、工程化

| 限制 | 现状 | 优先级 |
|---|---|---|
| ~~**测试是自制 stub**~~ | ✅ 已迁移：`scripts/verify.mjs` 的 DOM stub 已替换，场景保留为 `scripts/verify.test.tsx`（vitest + happy-dom） | P1 |
| ~~**类型未泛型化**~~ | ✅ 已实现：`ComponentType<P>`/`PropsOf` props 推导、camelCase 事件类型（见路线图 12） | P2 |
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
   - 触发时机：首次渲染后 mounted（子先父后，与 Vue 3 一致——挂载深度优先遍历，子组件先完成）；每次重渲染 updated；卸载前 beforeUnmount
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
10. ~~**错误边界 / Suspense**~~ ✅（本次提交，verify 场景 15）
    - 错误边界：`ErrorBoundary`（模块级栈注册，mountComponent update 包 try/catch，fallback 支持 VNode/函数）；已有错误的边界不重复触发（防死循环）
    - Suspense + lazy：`Suspense`（pending 注册/解析，fallback 显示）；`lazy(loader)` 异步组件（未完成渲染占位，完成后重建渲染；加载失败抛给错误边界）
    - 顺带修复：patch 复用分支检测实例活性（`isActive`），失效实例（如 Suspense fallback 替换后）重建而非复用
11. ~~**`ref` 模板引用**~~ ✅（本次提交，verify 场景 15）
    - 已实现：`props.ref`（函数或 `{ value }`）挂载时指向 DOM（元素）/ 组件实例，卸载时置 null
12. ~~**attribute fallthrough 阶段 2：Vue options 形态**~~ ✅ 已实施
    - `defineComponent` 支持对象参数 `{ props: [...], setup(props, ctx) }`；函数形态归一化为「props 白名单为空」
    - props 白名单分离：setup 只收白名单内属性，其余进 `ctx.attrs`（暴露 `$attrs`）
    - fallthrough 细化：白名单内属性不透传；白名单外全量透传（class/style 合并、显式优先）
    - `inheritAttrs: false` 支持
    - 函数形态兼容策略：保持「props 全量 + 全量 fallthrough」（向后兼容，建议）

### 阶段五：性能（P3，已完成）

13. ~~**P0 运行时短路**~~ ✅：`patchProps` 值比较跳过 / `patchVNode` props 引用短路 / `patchChildren` children 引用短路（详情见 `docs/perf-optimization.md`）
14. ~~**v-memo 指令**~~ ✅：行级显式依赖短路——deps 未变整棵子树复用（jsxFactory 从 props 提取 + renderer `sameMemoDeps`，babel 零改动）
15. ~~**`<solid>` 双模细粒度**~~ ✅：热点区域编译为 DOM 直连 effect + `mapArray` 项级 keyed 复用（公共前后缀跳过 + LIS 最小移动 + 顺序未变零移动）；benchmark 高亮 20.8 → 9.9（追平 Vue 8.6）
    - 二期候选：块内 createSelector 等价物（高亮只通知翻转行）；动态 class 的 classList 细分

### 阶段四：工程化（P2-P3）

11. ~~**测试迁移到 vitest + happy-dom**~~ ✅（已迁移：`scripts/verify.mjs` 的 DOM stub 已替换，场景保留为 `scripts/verify.test.tsx` 用例）
12. ~~**类型泛型化**~~ ✅（本次提交，verify 场景 16）：`defineComponent` props 推导（`ComponentType<P>` / `PropsOf`）、JSX 工厂重载签名（字符串标签 → `IntrinsicElements`，组件 → props 推导）、camelCase 事件类型（`onClick`/`onInput`/`onXxxCapture` 等）
13. devtools / SSR（远期）

---

