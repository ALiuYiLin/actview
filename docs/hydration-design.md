# ActView 水合（Hydration）设计方案

> 状态：设计方案（未实现）｜更新：P1 锁步遍历 + P2+ 编译期节点 id 锚点（Babel 注入）可选增强
> 关联：`renderToString.ts`（SSR 输出）、`renderer.ts`（mountVNode/patchProps）、`mountComponent.ts`（实例化）

## 一、总体架构：锁步并行遍历（React 模型）

| 模型 | 代表 | 前提 | 对 ActView |
|---|---|---|---|
| 锁步遍历（client 重渲染 + 认领现有 DOM） | React | 无模板，运行时 VNode | ✅ 天然匹配（无模板系统） |
| 编译期节点 id 锚点 | Vue 3 | 有编译器、模板已知 | ✅ 可用 Babel 注入（见第七节），作为增强层 |
| 序列化 VNode 数据 + 客户端重建 | — | 数据契约 | 仅作 Phase 3 状态传递的补充，不做主模型 |

**主模型**：React 式锁步遍历。可行性前提：`renderToString` 输出确定性（同一组件树 → 同一 HTML），服务端与客户端首次 render 结构必然一致，可依赖结构对齐。编译期节点 id 锚点作为可选增强层（第七节），解决文本节点容错与定点水合，不与锁步冲突（混合方案）。

## 二、核心机制

### 2.1 入口 API

```ts
createApp(Component).hydrate('#app')   // 认领容器内现有 DOM，不清空
// 内部：render(rootVnode, host, { hydrate: true })
```

与 `mount` 的唯一区别：不清空容器、节点从现有 DOM 认领而非创建。

### 2.2 匹配算法（P1 锁步）

客户端正常渲染 VNode 树，同时维护 **DOM 游标**（当前待认领节点索引）：

- **宿主元素**：认领 `container.childNodes[游标]`，校验 tagName 一致 → 绑定 `vnode.el`、游标前进；不一致 → 失配处理
- **文本节点**：认领文本节点，比对 `textContent`；不一致直接改写（文本修复成本最低，React 同策略）
- **组件**：正常走 `mountComponent`（创建实例、执行 setup、建立 render effect、`applyRef`），仅首次 render 走认领路径
- **Fragment**：视为内联兄弟，锁步游标自然经过（空白文本节点容错，见 2.6）
- **数组（列表）**：首版按位置认领（首次水合顺序必然一致）；key 对齐为 P2 增强

### 2.3 属性与事件接管

认领元素后执行 `patchProps(null, props, el)`：

- **幂等**：SSR 已输出的 class/style/属性重复设置无副作用
- **事件**：SSR 序列化跳过 `on*`（`serializeAttrs` 已如此），`patchProps` 的 `patchEvent` 在水合时统一附加监听器
- **scoped CSS**：`data-v-*` 已在 SSR HTML 中，`patchProps` 的 `SCOPED_ID_PROP` 翻译幂等

### 2.4 失配策略

- **默认**：warn + 从该节点起子树**回退客户端渲染**（创建新节点替换），页面永远可用
- **严格模式**：`hydrate({ strict: true })` 失配即抛错（测试/CI）
- **逐节点豁免**：`suppressHydration` 属性（对齐 React `suppressHydrationWarning`），用于必然差异节点（随机 id、时间戳、第三方注入）

### 2.5 受控输入（特殊处理）

ActView `setProp` 对 `value`/`checked` 只写 property 不写 attribute：

1. 认领 `<input value="a">` 后必须立即 `el.value = 'a'`（SSR attribute 只是默认值，不设 property 则显示不一致）
2. 水合完成前的用户输入/光标：认领即设 property + 沿用 `setInputValue` 光标保位；可选 `suppressHydration` 跳过

### 2.6 Fragment 空白文本容错

SSR 目前无注释锚点（`renderToString.ts:99-101` 直接拼接子节点）。P1 匹配器需对**空白文本节点**容错：认领时跳过纯空白 text node（或按需忽略缩进产生的文本）。P2 再评估引入 `<!-- -->` 锚点（对齐 Vue/React，需 SSR 输出变更+版本兼容）。

## 三、状态传递（服务端 → 客户端）

没有状态传递的水合只是 DOM 复用；真实应用需**续接服务端状态**（避免重复请求）：

```ts
// 服务端：useHydratedState(key, initializer) —— initializer 执行，结果进注册表
// 客户端：水合时从 payload 读取（跳过 initializer）
const state = useHydratedState('user:profile', () => fetchProfile())
```

- **payload 载体**：`renderToString` 收集注册表 → HTML 尾部 `<script id="__ACTVIEW_DATA__" type="application/json">{...}</script>`
- **客户端读取**：`hydrate` 启动时解析 payload 注入注册表；`useHydratedState` 按 key 取
- **与 `onServerPrefetch` 配对**：服务端预取数据写入注册表，构成"SSR 数据获取 → 水合续接"闭环
- **序列化约束**：仅 JSON 可序列化值；ref/reactive 由 `useHydratedState` 内部重建（`ref(v)`/`reactive(v)`），不做通用自动序列化

## 四、特殊场景

| 场景 | 设计 | 阶段 |
|---|---|---|
| **keyed 列表** | P1 按位置认领；P2 在 SSR 列表项根元素输出 key 标记（专用 `data-av-key`），按 key 认领，容忍顺序偏差 | P2 |
| **Fragment** | P1 无锚点 + 空白容错；P2 评估注释锚点 | P1/P2 |
| **Teleport** | SSR 约定输出顺序，水合认领 target 容器内节点 | P4 |
| **Transition** | 水合初始态直接呈现最终态，不播进入动画（打标记区分首次水合 vs 客户端挂载） | P4 |
| **KeepAlive** | 客户端首次水合无缓存，实例照常入缓存，后续复用现有逻辑 | P4 |
| **Suspense/lazy** | 先水合 fallback，异步 resolve 后走现有 patch 替换路径 | P4 |
| **scoped CSS** | 已就绪（2.3），无额外工作 | P1 |

## 五、SSR 侧配套改造（最小化）

1. 新增 `renderToString(vnode, { state })` 或 `renderToStringWithState`：收集 `useHydratedState` 注册表 + 输出 payload script
2. 根容器标记：SSR 输出包一层根标记（或约定容器即根），客户端 `hydrate` 从容器首个 childNode 开始认领
3. **P1 不引入注释锚点/key 标记**——保持 SSR 输出向后兼容

## 六、分阶段实施

| 阶段 | 内容 | 验收 |
|---|---|---|
| **P1** | 确定性 DOM 水合：宿主/文本/组件实例/refs/生命周期/事件/属性接管；positional 匹配；失配回退；`hydrate` API；Fragment 无锚点容错 | SSR 页面水合后交互正常、事件生效、响应式更新照常 |
| **P2** | keyed 列表 key 认领；受控输入 value/checked 专项；`suppressHydration` 豁免；锚点方案评估；编译期节点 id 锚点（第七节，实现路径已定）实现 | 列表移动/受控输入/文本容错边界用例 |
| **P3** | 状态传递：`useHydratedState` + payload + 序列化重建；与 `onServerPrefetch` 闭环 | 服务端预取数据水合后直接可用，无二次请求 |
| **P4** | Teleport / Transition / KeepAlive / Suspense；严格模式；流式 SSR（可选） | 全组件能力水合 |

## 七、可选增强：编译期节点 id 锚点（Babel 注入）

> 可行性分析：**可行**。Babel 插件（`plugins/babel/src/babel-plugin.ts`）已在遍历 JSXElement（`<solid>` 标记、具名插槽提取、JSX 编译），注入水合 id 是同类工作。详见下文设计要点。

### 7.1 动机

锁步遍历的弱点：

1. **文本节点敏感**：SSR 无注释锚点，缩进/空白差异会打乱位置匹配（Fragment 场景尤其脆弱）
2. **全量遍历**：每次水合都线性访问所有节点，无法"只水合动态部分"
3. **无法跳跃**：静态内容（不随状态变化的子树）也要逐节点核对

编译期 id 锚点让客户端**按 id 直接定位元素**，跳过静态内容、对文本节点完全免疫。

### 7.2 机制

插件在组件 render 的 JSX 子树内做 **DFS 编号**（相对组件子树，非全局），注入内部 prop：

```tsx
// 源码
function Card(props) {
  return (
    <div class="card">
      <h2>{props.title}</h2>
      <p>{props.body}</p>
    </div>
  )
}
// 编译后（示意）
defineComponent(function (props) {
  return () => _jsx("div", { __hid: 0, class: "card",
    children: [_jsx("h2", { __hid: 1, children: props.title }),
               _jsx("p", { __hid: 2, children: props.body })] })
})
```

- **id 空间**：组件子树内相对编号（0..n）——**不能全局编号**：组件实例复用/列表重复渲染时，同一元素的 id 常量会重复出现，全局唯一性不成立
- **确定性**：服务端/客户端同源同插件编译 → id 一致；三元/条件分支的所有可能元素都在编译期拿到 id（服务端/客户端执行相同分支，编号一致）
- **定位方式**：水合时组件子树根定位后（靠锁步或父锚点），子元素按 id 在子树 DOM 范围内直接检索/索引（对齐 Vue 3 hydration 的 nodeId 思路）

### 7.3 约束与限制

1. **列表（v-for）仍需 key**：重复渲染的列表项共享同一 id 常量，id 只解决"静态结构中的元素定位"，不解决"动态列表项去重/顺序偏差"——列表靠 key（P2 的 `data-av-key` 或现有 key 机制）
2. **降级路径无 id**：插件存在 `isJsxCall` 路径（`.js` 文件 JSX 已降级为 `_jsx()` 调用，无 JSX 节点，如 vitepress dist/client）——这些文件**注入不了 id** → 必须有锁步兜底 → **混合方案**：有 id 用 id 索引，无 id 退回结构对齐
3. **SSR 输出策略**：id 作为内部 prop 不输出（保持 HTML 干净），客户端靠"子树内相对编号重建索引"而非 DOM 属性查询；或输出 `data-av-hid` 属性便于直接 querySelector——需权衡 HTML 体积与定位速度
4. **版本一致性**：服务端与客户端必须用同一插件版本编译，id 编号规则变更会破坏对齐（锁步遍历无此约束，天然稳健）
5. **hoist/静态节点**：静态子树可整块跳过水合（id 直达边界），这是相对锁步的最大收益，但需插件标记静态性（复杂，P2 后评估）

### 7.4 结论

- **可行**：babel 插件是正确注入点，与既有 JSX 遍历逻辑同构
- **定位**：作为**正交增强层**，主模型仍是锁步遍历（稳健、无编译期依赖）；id 锚点解决文本容错与定点水合，P2/P3 阶段按需引入
- **混合形态**：`__hid` 存在 → 按 id 定位；不存在（降级 .js / 第三方）→ 锁步兜底

### 7.5 落地细节（Babel 实现路径）

#### 7.5.1 编号规则（DFS 前序，相对组件子树）

- 对组件 render 的 JSX 子树做 **DFS 前序编号**，仅 JSXElement 参与，根元素 = 0；DOM 顺序 == id 顺序，id 可直接作为"深度优先遍历计数"使用
- **Fragment**：不编号，其 children 接续父序列
- **组件元素**（`<Child/>`）：在父子树编号中占一个 id（边界标记）；Child 自己的 render 子树**从 0 重新编号**（相对各自组件）
- **三元/逻辑分支**（`cond ? <A/> : <B/>`、`cond && <A/>`）：两分支元素均获得确定性 id——服务端/客户端执行相同分支，编号一致
- **表达式容器**（动态文本 `{expr}`）：不编号
- **v-for 列表项**：每次迭代共享同一组 id 常量（列表对齐靠 key，见 7.3-1）
- **早退 return 分支**（`wrapEarlyReturns` 包的每个 render）：各分支树各自从 0 编号（它们是同一组件的互斥 render）
- **排除**：`<solid>` 块（黑盒，自身不参与水合编号）、`<template slot>`（插槽提取时已被移出 children）

#### 7.5.2 插件接入点

- **主 return**：`wrapComponentFn`（`babel-plugin.ts` 约 273-335 行）在确认 `isJsx` 后，对返回的 JSX 树递归编号，注入 `__hid` 属性：
  ```ts
  t.jsxAttribute(t.jsxIdentifier('__hid'), t.jsxExpressionContainer(t.numericLiteral(n)))
  ```
- **早退 return**：`wrapEarlyReturns`（约 349-368 行）对每个被包成 render 的 JSX 分支同样编号（各自从 0 起）
- **仅 `isJsx` 路径**（源码 JSX 可注入）；`isJsxCall` 降级路径（AST 无 JSX 节点）不编号 → 运行时锁步兜底
- **与既有遍历的关系**：编号可在 `walkJSX` 的递归里顺带完成（该函数已遍历整棵 JSX 树做插槽提取），或独立 DFS——需注意编号必须在插槽提取**之后**（template 已移出，避免占号）

#### 7.5.3 `__hid` 生命周期与剥离点

```
插件注入 __hid 属性 → compileJsxElement 编入 props
→ 元素创建时提取为 vnode.hid（对齐 key 处理，jsxFactory.ts:86-87 同款）
→ 从 props 剥离 → renderer.setProp / renderToString.serializeAttrs 天然不见
→ 水合器读取 vnode.hid 定位；组件元素的 hid 在水合创建实例时消费，不进组件 props
```

- 提取位置二选一：a) **jsxFactory 层**——`jsxImpl`/`createElement` 提取 `__hid` → `vnode.hid`（与 key 完全同构）；b) **插件编译层**——`compileJsxElement` 像 key 一样把 `__hid` 从 attrs 中摘出，`_jsx(type, props, key, hid)` 追加参数。推荐 a)：改动面最小、与 key 语义统一
- 剥离后 **SSR 输出零变更**（HTML 不含 `data-av-hid`，7.3-3 的 HTML 体积权衡自动消解）
- 需回归测试：SSR 输出、DOM 属性、组件 props 三处均不可见 `__hid`

#### 7.5.4 运行时水合使用

- **最小闭环（P2）**：锁步遍历 + **id 校验**——认领元素时校验 `vnode.hid === 当前 DFS 计数`，失配 warn + 回退；**文本免疫**：遇到空白/文本节点歧义时不再数文本，直接跳到"下一个期望 hid 的元素"
- **定点水合（P3+）**：配合插件静态性标记（hoisted 子树），用 hid 直达动态节点边界，跳过静态子树——需静态分析，延后评估
- **兜底**：`vnode.hid == null`（降级 .js / 第三方）→ 纯锁步

#### 7.5.5 落地步骤

1. 插件：DFS 编号 + `__hid` 注入（isJsx 路径，排除 solid/template，插槽提取后）
2. jsxFactory：`__hid` → `vnode.hid` 提取与剥离（对齐 key）
3. 回归测试：SSR 输出 / DOM 属性 / 组件 props 均不含 `__hid`
4. 水合器：锁步 + hid 校验 + 文本免疫跳跃
5. 测试矩阵：嵌套组件、三元分支、Fragment、v-for（key）、降级 `.js` 兜底、`suppressHydration` 豁免

#### 7.5.6 版本约束

编号规则是**服务端/客户端编译契约**：两端必须使用同一插件版本编译（编号规则变更即失配）。锁步遍历无此约束——这也是 id 锚点只能作为增强层、不能替代主模型的原因。

## 八、模块归属与拆分边界

> 结论先行：**运行时原语（renderToString / hydrate / useHydratedState）留在 core**；**服务端集成层独立为 `@actview/ssr` 包**。core 改动量中偏小（P1 约 300 行），风险集中在 mount 路径加分支。

### 8.1 改动量评估（P1）

| 改动点 | 位置 | 量级 | 风险 |
|---|---|---|---|
| 新增水合遍历器 | `runtime/hydrate.ts`（新文件） | ~200 行 | 低（纯新增） |
| 挂载路径加 hydrate 分支 | `renderer.ts` `mountVNode` | ~30 行 | 低 |
| 实例化加水合模式 | `mountComponent.ts` | ~50-80 行 | 中（实例生命周期最敏感处） |
| 状态传递（P3） | `renderToString.ts` + `useHydratedState` | ~80 行 | 低 |

**不碰**：响应式系统、patch/diff 引擎、实例机制主体、refs/生命周期——全部复用。水合本质是"挂载的认领模式"，与挂载路径同构，改动是**加分支而非改逻辑**。

### 8.2 运行时原语为什么留 core

1. `renderToString` **已在 core**（`packages/core/src/runtime/renderToString.ts`），且从 `actview` 根包导出——拆出即 breaking
2. 水合遍历器要复用 `patchProps`/`setProp`/`patchChildren`/`mountComponent` 等**未导出的内部符号**——独立成包需给 core 开内部导出口子或重复实现属性应用逻辑，得不偿失
3. ESM tree-shaking 已保证不用的应用不打包 SSR 代码，拆包对体积零收益

### 8.3 独立层：`@actview/ssr`（服务端集成）

```
┌─ packages/core ─────────────────────────────┐
│  renderToString()  ← 已有                    │
│  hydrate()         ← P1 新增（挂载认领模式）    │
│  useHydratedState  ← P3 新增                  │
│  （公开 API，不暴露内部符号）                   │
└──────────────┬───────────────────────────────┘
               │ 依赖方向：core ← ssr（单向）
┌──────────────▼───────────────────────────────┐
│  @actview/ssr（独立包，可选安装）               │
│  - renderPage(Component, { url })：          │
│      renderToString + HTML 壳 + payload 注入  │
│  - viteSsrPlugin()：dev 中间件、模块转译、     │
│      manifest、客户端入口注入                  │
│  - 流式输出 / 流挂起（可选）                    │
└──────────────────────────────────────────────┘
```

对齐生态分层：React = `react-dom`（运行时）+ `react-dom/server`；Vue = `@vue/runtime-*` + `@vue/server-renderer` + 第三方 vite-ssr。`@actview/ssr` 只依赖 core 的**公开 API**，不碰内部实现；作为 P1 原语落地后的第二个交付物。

### 8.4 折中方案（暂不开新包）

core 内做**目录级隔离**，保持导出不变（非 breaking）：

```
packages/core/src/runtime/ssr/
  ├─ renderToString.ts   ← 从 runtime/ 平移（导出不变）
  ├─ hydrate.ts          ← P1 新遍历器
  └─ payload.ts          ← 状态注册表 + 序列化（P3）
```

依赖方向单向：`runtime/ssr/` 引用渲染器，渲染器不反向依赖。后续要拆 `@actview/ssr` 时整目录平移即可。

### 8.5 结论

- **改动量**：P1 约 300 行、集中在 mount 路径加分支 + 一个新文件；唯一敏感点是 `mountComponent` 的水合分支
- **独立时机**：运行时原语留 core（耦合 + 已是现状 + 无拆包收益）；`@actview/ssr` 集成包（HTML 壳 / vite 插件 / 流式 / payload 注入）是清晰的独立边界
- **建议**：P1 按"core 内新增 `runtime/hydrate.ts` + mount 分支"落地（或 8.4 的目录隔离），P1 后评估 `@actview/ssr`

## 九、关键设计决策汇总

1. **匹配模型**：锁步遍历为主（React 式）——ActView 无模板，纯运行时 VNode 结构对齐天然成立；编译期 id 锚点（Babel 注入）为可选增强，解决文本容错与定点水合
2. **水合是挂载的"认领模式"**：`mountVNode`/`mountComponent` 加 hydrate 分支，复用全部实例化/响应式逻辑——水合后渲染器照常工作，无"React 式接管切换"
3. **失配默认回退而非报错**：页面可用性优先，strict 模式兜底测试
4. **状态传递显式化**：`useHydratedState(key, init)` 按 key 续接，不自动序列化全状态
5. **SSR 输出 P1 零变更**：无锚点、无 key 标记，P2 再按需演进
6. **id 锚点约束**：相对组件子树编号（非全局）、列表仍需 key、降级路径锁步兜底、服务端/客户端同插件版本
7. **模块边界**：运行时原语（renderToString/hydrate/useHydratedState）留 core；服务端集成（HTML 壳 / vite 插件 / 流式 / payload 注入）独立为 `@actview/ssr`，只依赖 core 公开 API（见第八节）
