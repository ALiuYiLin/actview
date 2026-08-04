# 测试说明 — scripts/verify 覆盖的场景

> 本文档说明 `scripts/verify.mjs` + `scripts/verify-entry.tsx` 测试了什么、怎么测的、怎么运行。

---

## 1. 测试基础设施

框架的渲染器依赖真实 DOM（`document.createElement` 等），而仓库没有浏览器测试环境。
因此 `verify.mjs` 内置了一个**最小 DOM stub**，用普通对象模拟真实 DOM 的关键行为：

- `createElement` / `createTextNode` / `appendChild` / `removeChild` / `replaceChild`
- `appendChild` 实现真实 DOM 的**移动语义**（已挂载节点先移除再追加）
- `childNodes` / `setAttribute` / `className` / `style` / `value`
- 文本节点的 `data` 与 `textContent` 互为别名（与真实 DOM 一致）
- `querySelector` 按选择器缓存容器（支持多个应用同时挂载）

测试通过 **vite 的 `ssrLoadModule`** 加载 `.tsx` 模块——走与浏览器完全相同的管线：
`actview` Babel 插件（defineComponent 转换）→ esbuild JSX 转换 → 模块执行（`createApp().mount(...)`）。
即编译期与运行期全链路都被覆盖。

**运行方式**：

```bash
node scripts/verify.mjs
```

当前共 **23 项断言**，全部通过时输出 `23 通过 / 0 失败`，并以退出码 0 结束。

---

## 2. 场景总览

| 场景 | 验证内容 | 断言数 |
|---|---|---|
| ① 响应式文本自动更新 | reactive 状态变化 → effect 自动重跑 patch | 2 |
| ② keyed diff | 列表按 key 复用 / 重排 / 增删 | 4 |
| ③ props 细粒度更新 | 父传子 props 变化 → 精确更新、不重挂 | 5 |
| ④ 依赖隔离 | 子组件内部状态变化不连带父组件重渲染 | 8 |
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

### 冒烟：src/main.tsx 检验页

加载真实检验页 `src/main.tsx`（四个 demo 卡片：响应式 / keyed / props / 条件渲染），断言：

1. 页面根元素挂载成功；
2. 标题「actview — 响应式前端框架检验页」存在；
3. 渲染出 4 个 `demo-card`；
4. keyed 列表初始 3 项。

---

## 4. 断言清单（23 项）

```
场景 ①：挂载后 count 文本为 "1" / count=42 后文本自动更新为 "42"
场景 ②：初始 a,b,c / 重排 c,a,b / 删除+新增 a,d / 头部新增 x,a,d
场景 ③：setup 1 次 / msg=hello / msg→world / setup 仍 1 次 / span 引用不变
场景 ④：初始 render 1 次 / 含 inner / 子更新 changed / 父仍 1 次
        / props 同步 hello2! / 父 2 次 / 子更新 again / 父仍 2 次（核心）
冒烟：根元素 / 标题 / 4 卡片 / keyed 列表 3 项
```

---

## 5. 如何扩展

新增场景三步走：

1. 在 `scripts/verify-entry.tsx` 写组件，用 `globalThis.__xxx` 暴露驱动接口，`createApp(...).mount('#xxx')` 挂到新容器；
2. 在 `scripts/verify.mjs` 用 `hosts.get('#xxx')` 取容器，写 `check('描述', 条件)` 断言；
3. `node scripts/verify.mjs` 运行，保持全绿。

> 注意：`verify-entry.tsx` 在 `tsconfig` 的 `include` 之外，类型检查报错只出现在编辑器（inferred project），不影响 `tsc` 与 `verify` 运行。
