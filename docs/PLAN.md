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
12. **attribute fallthrough 阶段 2：Vue options 形态**（📋 设计见 docs/attr-fallthrough.md，阶段 1 已完成）
    - `defineComponent` 支持对象参数 `{ props: [...], setup(props, ctx) }`；函数形态归一化为「props 白名单为空」
    - props 白名单分离：setup 只收白名单内属性，其余进 `ctx.attrs`（暴露 `$attrs`）
    - fallthrough 细化：白名单内属性不透传；白名单外全量透传（class/style 合并、显式优先）
    - `inheritAttrs: false` 支持
    - 函数形态兼容策略：保持「props 全量 + 全量 fallthrough」（向后兼容，建议）

### 阶段四：工程化（P2-P3）

11. ~~**测试迁移到 vitest + happy-dom**~~ ✅（已迁移：`scripts/verify.mjs` 的 DOM stub 已替换，场景保留为 `scripts/verify.test.tsx` 用例）
12. ~~**类型泛型化**~~ ✅（本次提交，verify 场景 16）：`defineComponent` props 推导（`ComponentType<P>` / `PropsOf`）、JSX 工厂重载签名（字符串标签 → `IntrinsicElements`，组件 → props 推导）、camelCase 事件类型（`onClick`/`onInput`/`onXxxCapture` 等）
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
| 本次提交 | 错误边界 / Suspense / lazy / ref | `ErrorBoundary`（栈注册 + fallback）；`Suspense`+`lazy` 异步组件；`props.ref` 模板引用；修复复用分支对失效实例重建；verify 场景 15 |
| 本次提交 | 类型泛型化 | `ComponentType<P>`/`PropsOf` props 推导；jsx 工厂泛型重载（标签→IntrinsicElements、组件→props、Fragment）；camelCase 事件类型（`onClick` 等 + capture）；verify 场景 16（@ts-expect-error 编译期反向断言） |
| 提交 c7e6c6e | 修复 effect 内修改数组爆栈 | `pauseTracking`/`resetTracking`（数组修改方法暂停收集）；`ReactiveEffect.run()` 重入保护 + `shouldTrack` 恢复；verify 场景 17 |
| 提交 e060ebf | 修复同索引 diff 文本错位 + Fragment 文本索引偏移 | vnode 级 children 缓存（`__avChildren`），文本 vnode 的 el 跨 diff 持久化，不再用 `childNodes[index]` 猜测；verify 场景 18 |
| 本次提交 | 修复空文本节点残留 | 空文本不创建节点、patch 置空移除旧节点、恢复时按锚点重建；verify 场景 19 |
| 本次提交 | 具名插槽 | Babel 插件 `<template slot="name">` 编译期转 `slots` prop（支持作用域参数）；verify 场景 20 |
| 本次提交 | EffectScope 自动停止 | 组件实例持 scope，setup 期间 watch/computed/render effect 注册，卸载时统一停止；verify 场景 21 |
| 本次提交 | 修复生命周期钩子内改响应式无限循环 | 钩子触发统一 `invokeHooks` + `pauseTracking`（对齐 Vue 3 post 队列语义）；LifecyclePage 重构（普通变量计数 + tick 渲染时钟）；verify 场景 12 回归 |
| 本次提交 | attribute fallthrough 阶段 1（全量透传） | `mergeAttrsToRoot`：render 后把外部 props（attrs）合并到单根元素（class 拼接、其余根元素显式优先、事件透传、Fragment 多根/内置组件不透传）；解决 `<Content class="vp-doc" />` 丢 class；verify 场景 27（8 用例）；阶段 2 见「阶段三 12」 |
| 本次提交 | scoped CSS（新包 `@actview/plugin-scoped`，v0.2.0 重构） | 纯编译期 scoped：`import './x.css?scoped'` 自动触发文件级注入 `data-v-md5(路径)前8位`（源码 JSX 与 `_jsx()` 双形态、整文件所有元素、`<template slot>` 插槽内容额外 `-s` 属性、多 css 多 hash、`_jsx('div', null)` 也注入）+ PostCSS 变换（移植 Vue `pluginScoped.ts`：`:deep`/`:slotted`/`:global`、keyframes 重命名）；CSS/JSX 同源 hash（经 Vite resolver，alias 兼容）；零运行时成本、`renderToString` 兼容；css.test 17 + babel.test 13 + scripts/scoped.test 5 用例。**已知限制**：文件级语义下同文件所有组件都带 hash（跨文件组件不受影响）；`:slotted()` 仅同文件内有效（纯编译期无运行时 scope 传递）；useScoped API 已移除（breaking，v0.1.0 → v0.2.0） |
| 本次提交 | 插件包拆分与改名 | `@actview/plugin` → 拆分：`@actview/babel-plugin-actview`（v0.1.0，defineComponent 编译核心 + 测试独立）+ `@actview/plugin-vite`（v1.0.11 继承版本，薄壳 vite 插件依赖 babel 包）；旧 `@actview/plugin`（v1.0.12）转 deprecated 兼容 re-export；release.mjs 发布顺序 babel → vite → plugin；vite.config/文档/README 全量更新；产物与改名前一致（179 用例三绿） |
| 本次提交 | Babel 支持三元/`&&` return | babel-plugin-actview 的 `isRenderExpr`：结尾与早退 return 识别 ConditionalExpression/LogicalExpression（任一分支含 JSX/_jsx，null 分支不单独触发），`return cond ? <Comp/> : null` 不再裸函数崩溃（React 惯例单根写法 → fallthrough 正常）；非渲染三元/`p.v ?? null`/`a && null` 不误转；babel.test +10、verify +1（190 用例三绿） |
| 本次提交 | 透传机制档 2（完整 Vue 对齐） | `defineComponent({ props, setup(props, ctx), inheritAttrs? })` options 形态；props 白名单分离（声明内 → setup.props、声明外 → ctx.attrs）；mergeAttrsToRoot 移除白名单改**全量透传**（值类型过滤：string/number/boolean/style 对象/on* 透传，数组/函数/对象跳过）；函数形态兼容策略（props=attrs=全量）；inheritAttrs: false；更新链路 patchComponent 同步拆分 attrs（propsChanged || attrsChanged 触发 update，修复 attrs-only 更新）；SSR setup 传空 ctx.attrs（options 形态不崩）；**data-v-\* 全量透传落子 root = 子组件 root 继承父 scopeId（scoped 跨文件 root 样式生效）**；verify 场景 27 +7（197 用例三绿）；差异点（事件显式优先/值类型过滤/根字符串 style 保留）文档化 |
| 本次提交 | 修复 plugin-scoped node_modules 硬跳过（v0.2.1） | jsx 子插件不再按路径跳过 node_modules：源码分发的主题/库包（actpress 主题等）发布在 node_modules 下也会合法 `import '...css?scoped'`，原硬跳过导致「CSS 已 scoped 化但元素无属性」→ 主题样式全失效；`?scoped` 快速跳过对全部文件安全（不命中即返回 null，性能不受影响）；vite-plugin 层新增 5 用例锁定（node_modules 注入 / 无 ?scoped 返回 null / CSS 侧一致 / 两侧 hash 一致）（210 用例三绿） |
