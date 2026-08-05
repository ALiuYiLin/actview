# 测试说明 — actview 测试覆盖与后续计划

> 本文档说明 actview 的测试体系：`scripts/verify.test.tsx`（框架自研场景）+ `scripts/actview.test.tsx`（Vue 3 迁移用例），以及**后续待执行的测试计划**。
> 原 `scripts/verify.mjs` + `verify-entry.tsx`（手写 DOM stub）已迁移到 vitest，场景保留为用例。

---

## 1. 测试基础设施

测试基于 **vitest + happy-dom**：

- **happy-dom** 提供真实的 DOM/window 环境（`document.createElement`、事件、`window.history`、input 光标语义等），不再需要手写 DOM stub；
- **vitest 复用 vite 配置**（`vite.config.ts` 的 `test` 块）——测试文件走与浏览器完全相同的编译管线：`actview` Babel 插件（defineComponent 转换、具名插槽转换）→ esbuild JSX 转换 → 模块执行（`createApp().mount(...)`），编译期与运行期全链路都被覆盖；
- 每个场景是一个独立 `it` 用例，组件与状态定义在用例内部（相互隔离）。

**运行方式**：

```bash
pnpm test        # 即 vitest run（自动收集 scripts/**/*.test.{ts,tsx}）
```

当前共 **81 个用例**（verify 36 + actview 迁移 45），全部通过时退出码为 0。

---

## 2. 场景总览（scripts/verify.test.tsx，36 用例）

| 场景 | 验证内容 |
|---|---|
| ① 响应式文本自动更新 | reactive 状态变化 → effect 自动重跑 patch |
| ② keyed diff（LIS） | 列表按 key 复用/重排/增删；**insertBefore 次数断言（最小移动，非整体重排）** |
| ③ props 细粒度更新 | 父传子 props 变化 → 精确更新、不重挂 |
| ④ 依赖隔离 | 子组件内部状态变化不连带父组件重渲染 |
| ⑤ 路由切换 | RouterView 切换 / 动态参数 / back / RouterLink |
| ⑥ 数组方法 | push / pop / splice / reverse / 索引赋值触发更新 |
| ⑦ for...in / in | 增删 key 后遍历与 in 检查更新 |
| ⑧ reactive API | Date 不崩 / markRaw 隔离 / readonly 拦截 / shallow 浅层 |
| ⑨ input 光标 | 聚焦时赋值后恢复、未聚焦不干预 |
| ⑩ 调度批处理 + nextTick | 同轮多次修改只触发一次更新；nextTick 在更新后回调 |
| ⑪ 事件系统 | addEventListener / capture（onClickCapture）/ invoker 复用不重绑 / 解绑 |
| ⑫ 生命周期钩子 | onMounted / onUpdated / onBeforeUnmount 按时机触发 |
| ⑬ computed / ref / watch | 脏标记惰性缓存；ref 响应式；watch immediate/cleanup |
| ⑭ 插槽 / 动态组件 / keep-alive | 作用域插槽；`<component is>`；KeepAlive 缓存不重建 |
| ⑮ 错误边界 / Suspense / lazy / ref | ErrorBoundary fallback；Suspense 异步组件；模板引用 |
| ⑯ 类型泛型化 | 编译期 @ts-expect-error 反向断言 props 推导/事件类型 |
| ⑰ effect 内改数组 | pauseTracking + 重入保护：不爆栈、不无限重入 |
| ⑱ 同索引 diff 文本 | vnode 级 children 缓存：Fragment 混排/纯文本列表不错位 |
| ⑲ 空文本节点 | 空文本不建节点、置空移除、恢复重建 |
| ⑳ 具名插槽 | `<template slot="name">` 编译期转 slots prop（含作用域参数） |
| ㉑ EffectScope | 组件卸载自动停止 watch/computed/render effect |
| 冒烟 | `src/main.tsx` 检验页端到端渲染 |

---

## 3. Vue 3 迁移测试（scripts/actview.test.tsx，45 用例）

> 来源：`E:\code3\vue3\packages\reactivity\__tests__\`（effect / reactive / reactiveArray / computed / watch 核心用例）。
> 适配：`effect` → `runEffect`、`stop` → `e.stop()`、watch 异步 flush 用 `await nextTick()`；跳过依赖未实现 API（Map/Set 代理、isReactive、toRaw、computed setter 等）的用例。

| 分组 | 覆盖内容 | 用例数 |
|---|---|---|
| effect 基础 | 首次执行一次 / 基本/多属性/嵌套观察 / delete / has / 原型链（属性+has）/ 值未变不触发 / 分支切换 / 子 effect 不连累父 / stop / 依赖清理 | 14 |
| reactive 对象 | 嵌套响应 / 不可写 set 不触发 / 原始值变化反映 / 未观察值自动包装 / 幂等（reactive(proxy)）/ 重复观察同一值 / markRaw / 非可扩展不代理 / __v_skip / ref 不自动解包 | 10 |
| 数组响应 | 数组响应 / 变更反映到原始 / delete 不触发 length / 已有索引赋值不触发 length / 非整数 key 不触发 length / shift / for...in 跟踪 length / join+push | 8 |
| computed | 更新值 / 惰性 / 触发 effect / 链式 / 链式触发 | 5 |
| watch | 回调 / 多源 / 对象源 deep / immediate / cleanup / 批处理执行顺序 / immediate reset | 7 |

**迁移检验出的框架 bug（已修复）**：数组 length 依赖不触发、不可写 set 仍触发、reactive(proxy) 不幂等、非可扩展/`__v_skip` 被代理、watch 对象源永不回调——详见 `docs/bugs.md` 第四节。

---

## 3. 各场景详解

### 场景 ①：响应式文本自动更新

**测试代码**：`App` 组件内 `reactive({ count: 1 })`，渲染 `<span>hello: {state.count}</span>` 与受控 `input`。

**验证流程**：

1. 挂载后 span 文本为 `"1"`；
2. 修改 `state.count = 42`（模拟 input 输入）；
3. 断言 span 文本自动变为 `"42"`。

**覆盖机制**：`runEffect(update)` 中 render 读 `state.count` → track 收集 effect；`set` → trigger → effect 重跑 → 新 VNode → patch 更新文本。同时验证 `input.value` 的 property 更新路径。

### 场景 ②：keyed diff

**测试代码**：`ListApp` 渲染 `items.map(item => <li key={item}>{item}</li>)`。

**验证流程**（依次执行，每次断言 DOM 顺序）：

1. 初始 `['a','b','c']`；
2. 重排为 `['c','a','b']` → 断言顺序 c,a,b（key 命中复用 + appendChild 移动）；
3. 删除 + 新增为 `['a','d']` → 断言 a,d（卸载未复用节点、挂载新节点）；
4. 头部新增为 `['x','a','d']` → 断言 x,a,d。

**覆盖机制**：`patchKeyedChildren` 的「旧 key→index 映射 → 命中 patch 复用 / 未命中创建 → 卸载未复用 → 按新顺序 appendChild 重排」四条路径全部走到。

### 场景 ③：props 细粒度更新

**测试代码**：`Parent` 渲染 `<Child msg={parentState.msg} />`，`Child` 用 `childSetupCount` 计数 setup 执行次数。

**验证流程**：

1. 挂载后 setup 恰好执行 1 次；
2. `msg` 初始为 `"hello"`；
3. 父状态改为 `"world"` → 子组件文本更新；
4. **setup 仍只执行 1 次**（组件实例未被重建）；
5. `span` 元素引用不变（精确更新而非重建 DOM）。

**覆盖机制**：`patchComponent` 的 props 未变则复用、变了则 `updateProps` 增量写入 + `instance.update()` 手动调度；`setup` 只在 `mountComponent` 调用一次。

### 场景 ④：依赖隔离（回归场景）

**测试代码**：`ParentWithLocal` 用 `markParentRender()` 计数每次 render；子组件 `ChildWithLocal` 同时读取 `props.msg` 与模块级内部状态 `innerState.local`。

**验证流程**（断言顺序经过专门设计）：

1. 初始：父 render 1 次，子文本含 `local: inner`；
2. 子内部状态改 `'changed'` → 子文本更新，**父 render 仍 1 次**（基线）；
3. 父 props 改 `'hello2!'` → 子文本同步，父正常重渲染（2 次）；
4. **核心断言**：props 更新之后再次修改子内部状态 → 父 render **仍 2 次**。

**为什么第 4 步是关键**：props 更新路径曾经直接裸调用 `instance.update()`，导致子组件 render 在「父 effect 上下文」中执行，把父 effect 误收集进子内部状态的依赖——此后子内部状态一变化，父组件就被连带整树重渲染。修复为 `instance.update = () => effect.run()` 后，props 路径与内部状态路径统一走完整 effect 语义（cleanup + 正确 activeEffect），父组件不再被污染。

该场景是**先复现后修复**的回归测试：修复前第 4 步断言失败（父 render 变成 3 次），修复后通过。

### 场景 ⑤：路由（RouterView 组件切换）

**测试代码**：`@actview/router` 的 `createRouter` + `createMemoryHistory`（内存模式，无需浏览器 history），路由表含 `/`、`/about`、`/user/:id`；`RouterApp` 渲染 `RouterLink` 导航栏 + `RouterView`。

**验证流程**：

1. 初始渲染 Home；
2. `router.push('/about')` → RouterView 切换为 About；
3. `router.push('/user/42')` → 渲染 User 且 `props.params.id` 为 `'42'`（动态参数）；
4. `router.back()` → 回到 About（memory history 栈）；
5. 直接调用 `RouterLink` 渲染出的 `<a>` 的 `onclick` → 触发导航（拦截默认跳转）；
6. `href` 属性正确。

**覆盖机制**：`currentRoute` 是 `reactive` 状态，`RouterView` 每次渲染时读它并重新匹配 → 路由变化触发 RouterView 的 effect → patch 按组件 `type` 变化走替换路径完成组件切换。

**关键设计点**：`RouterView` 手写 `defineComponent` + render 闭包（不依赖 Babel 插件转换）——匹配逻辑必须每次渲染时执行，若写在组件函数体（会被 Babel 转成 setup）中则只执行一次，组件切换失效。

### 冒烟：src/main.tsx 检验页

加载真实检验页 `src/main.tsx`（四个 demo 卡片：响应式 / keyed / props / 条件渲染），断言：

1. 页面根元素挂载成功；
2. 标题「actview — 响应式前端框架检验页」存在；
3. 渲染出 4 个 `demo-card`；
4. keyed 列表初始 3 项。

---

## 4. 用例清单（10 个）

```
场景 ①：响应式：count 1 =》 42 自动更新，input.value 同步
场景 ②：keyed diff：重排 c,a,b / 删除+新增 a,d / 头部新增 x,a,d
场景 ③：props：setup 1 次 / msg hello =》 world / setup 仍 1 次 / DOM 引用不变
场景 ④：依赖隔离：子内部状态变化不连带父（含 props 更新后的核心断言）
场景 ⑤：路由：初始 Home / push About / push /user/:id / back / link 点击 / href
场景 ⑥：数组方法：push / pop / splice / reverse / 索引赋值
场景 ⑦：for...in / in：增删 key 后遍历与 in 检查更新
场景 ⑧：reactive API：Date 不崩 / markRaw 隔离 / readonly 拦截 / shallow 浅层
场景 ⑨：input 光标：聚焦时赋值后恢复、未聚焦不干预
冒烟：main.tsx 路由版：首页总览 =》 push /reactive =》 push /list
```

---

## 5. 如何扩展

新增场景三步走：

1. 在 `scripts/verify.test.tsx` 的对应 `describe` 中新增一个 `it` 用例，组件与状态定义在用例内部，用 `mount('#xxx', Component)` 挂载；
2. 通过返回的宿主元素 + `expect(...).toBe(...)` 断言（文本/结构/计数等）；
3. `pnpm test` 运行，保持全绿。

> 注意：`scripts/*.test.tsx` 不在 `tsconfig` 的 `include` 之内，类型检查报错只出现在编辑器（inferred project），不影响 `tsc` 与 `vitest` 运行。

---

## 4. 后续测试计划（待执行）

> 记录尚未迁移/补齐的测试工作，按优先级排列，完成后在对应项标记 ✅。

### 4.1 迁移 Vue 3 runtime-core 测试（P1，工作量大）

Vue 3 `packages/runtime-core/__tests__/` 覆盖渲染器/组件能力，最能检验 renderer 层 bug。需要适配：
- `h()` → 我们的 `createElement`（@actview/jsx 已导出）
- 组件对象形式（`{ setup, render }`）→ `defineComponent`（setup 返回 render 函数）
- 推荐文件：`component.spec.ts`（组件更新/props）、`rendererChildren.spec.ts`（children diff）、`apiLifecycle.spec.ts`（生命周期顺序）、`errorHandling.spec.ts`（错误处理）、`componentSlots.spec.ts`（插槽）

### 4.2 补齐 reactivity 语义差异（P2，低成本高价值）

- **数组 identity 方法**：`indexOf` / `includes` / `lastIndexOf` 对 reactive 元素的 toRaw 比较（Vue 3 `arrayInstrumentations` 有专门处理；我们目前直接透传，`includes(reactiveObj)` 可能找不到）
- ~~**`toRef` / `toRefs`**~~ ✅（已实现，verify 场景 22）：对象属性转 ref（`ObjectRefImpl` 读写委托源对象，天然 track/trigger；已是 ref 的属性原样返回）
- **`shallowRef` / `triggerRef`**：浅层 ref（不包 reactive，手动 triggerRef）
- **ref 在 reactive 嵌套中的自动解包**（Vue 3：`reactive({ n: ref(1) }).n === 1`；我们返回 ref 本体）
- **`isReactive` / `isReadonly` / `toRaw` 工具函数**（需在代理上标记 `ReactiveFlags`）
- **`computed` setter**（可写 computed：`{ get, set }`）

### 4.3 迁移 Vue 3 reactivity 剩余 spec（P3）

- `effectScope.spec.ts`：scope 嵌套 / detached / run / stop 语义
- `readonly.spec.ts`：深层只读 / 嵌套拦截 / 与 reactive 交互
- `shallowReactive.spec.ts` / `shallowReadonly.spec.ts`
- `gc.spec.ts`：WeakMap 依赖回收（需 `targetMap` 暴露）

### 4.4 框架自研补充场景（P3）

- **keep-alive 多组件缓存**（>2 个组件切换、缓存上限语义）
- **ErrorBoundary 嵌套**（内层边界优先捕获）
- **Suspense 多 lazy 并发**（全部 resolve 后才显示 children）
- **组件卸载期间的响应式更新**（unmount 后 trigger 不应报错）
- **LIS diff 逆序/随机重排**的大列表压力用例

### 4.5 迁移方法备忘

1. 新建 `scripts/xxx.test.tsx`（不要改动 `verify.test.tsx` 现有用例）；
2. 从 `E:\code3\vue3` 对应 spec 拷贝用例，替换 import 为 actview API；
3. 适配规则：`effect` → `runEffect`（含 `stop`）、组件对象 → `defineComponent`、`h` → `createElement`、异步 flush 用 `await nextTick()`；
4. 跳过依赖未实现 API 的用例，在文件头注释说明；
5. `pnpm test` 保持全绿；新检验出的 bug 修复后记入 `docs/bugs.md`。
