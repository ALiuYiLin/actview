# 测试说明 — scripts/verify.test.tsx 覆盖的场景

> 本文档说明 `scripts/verify.test.tsx`（vitest + happy-dom）测试了什么、怎么测的、怎么运行。
> 原 `scripts/verify.mjs` + `verify-entry.tsx`（手写 DOM stub）已迁移到 vitest，场景保留为用例。

---

## 1. 测试基础设施

测试基于 **vitest + happy-dom**：

- **happy-dom** 提供真实的 DOM/window 环境（`document.createElement`、事件、`window.history`、input 光标语义等），不再需要手写 DOM stub；
- **vitest 复用 vite 配置**（`vite.config.ts` 的 `test` 块）——测试文件走与浏览器完全相同的编译管线：`actview` Babel 插件（defineComponent 转换）→ esbuild JSX 转换 → 模块执行（`createApp().mount(...)`），编译期与运行期全链路都被覆盖；
- 每个场景是一个独立 `it` 用例，组件与状态定义在用例内部（相互隔离）。

**运行方式**：

```bash
pnpm test        # 即 vitest run
```

当前共 **10 个用例**（场景 1-9 + 冒烟），全部通过时退出码为 0。

---

## 2. 场景总览

| 场景 | 验证内容 | 断言数 |
|---|---|---|
| ① 响应式文本自动更新 | reactive 状态变化 → effect 自动重跑 patch | 2 |
| ② keyed diff | 列表按 key 复用 / 重排 / 增删 | 4 |
| ③ props 细粒度更新 | 父传子 props 变化 → 精确更新、不重挂 | 5 |
| ④ 依赖隔离 | 子组件内部状态变化不连带父组件重渲染 | 8 |
| ⑤ 路由切换 | RouterView 组件切换 / 动态参数 / back / RouterLink | 6 |
| 冒烟测试 | `src/main.tsx` 检验页端到端渲染 | 4 |

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
