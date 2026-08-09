# Attribute Fallthrough（非 prop 属性透传）设计方案

> 状态：📋 待实施（研究完成，未改代码）
> 目标：对齐 Vue 的「未声明属性自动落到组件根元素」语义，解决 `<Content class="vp-doc" />` 等场景下 class/属性被丢弃的问题（VitePress 迁移场景）。

---

## 1. 背景

VitePress 迁移到 ActView 时发现：

```tsx
<Content class="vp-doc" />
```

传入组件的 `class` 被丢弃，页面根元素没有 `vp-doc` class，导致 `.vp-doc ...` 前缀样式全部失效。

Vue 通过 **attribute fallthrough** 解决：组件未声明为 props 的属性（attrs）自动合并到组件根元素。

---

## 2. ActView 现状：为什么 class 会丢

组件 props 传递链路：

```
<Content class="vp-doc" />
  → jsx(Content, { class: 'vp-doc' })        // jsxFactory
  → vnode.props = { class: 'vp-doc' }
  → mountComponent:
       props = { ...vnode.props }            // 全量复制
       instance.render = __setup(props)      // props 全量传给 setup
  → render() 返回根 vnode（组件内部 JSX 自己写的属性）
  → patch(null, subTree)                     // 只应用 subTree.props
```

关键点：外部传入的 `class` 只存在于 `props` 对象（setup 可读），但**渲染时只有组件内部 JSX 写在根元素上的属性会进 DOM**。`props.class` 不会自动落到根元素。

相关代码位置：

| 文件 | 作用 |
|---|---|
| `packages/core/src/runtime/component.ts` | `defineComponent(setup)` — 仅函数形态，返回 `{ __setup }` |
| `plugins/babel-plugin-actview/src/babel-plugin.ts` | `function App(props) {...}` → `defineComponent(function(props){...})` |
| `packages/core/src/runtime/mountComponent.ts` | `props = {...vnode.props}`；`instance.render = __setup(props)`；`update()` 里 render + patch |
| `packages/core/src/runtime/renderer.ts` | `patchComponent` / `updateProps`（父组件增量更新 props + 手动 update） |

---

## 3. Vue 3 机制对照

| 机制 | Vue 3 行为 |
|---|---|
| props 白名单 | `props: [...]` / 对象声明；白名单之外的属性进 `ctx.attrs` |
| 单根节点 | **attrs 自动合并到根元素**（class/style 特殊合并，其余「根元素显式声明优先」） |
| 多根（Fragment） | 不自动 fallthrough，需 `v-bind="$attrs"` 显式绑定 |
| class / style | 归一化合并（normalizeClass / normalizeStyle），组件自带 + 外部共存 |
| 事件（onXxx） | 也是 attrs；fallthrough 自动绑定到根元素（invoker 机制，组件与外部 handler 并存） |
| 无 props 声明的组件 | 所有属性都是 attrs → 全部 fallthrough；setup 的 props 为空对象 |
| `inheritAttrs: false` | 关闭自动透传 |

---

## 4. ActView 实施方案（两阶段）

### 阶段 1：全量 attrs fallthrough（最小改动，解决背景问题）

**不改 defineComponent / Babel 插件 / props 语义**，只在组件挂载时做「根元素合并」。

```
update() 里 render() 之后、patch 之前：
  mergeAttrsToRoot(subTree, instance.props)
```

合并规则（对齐 Vue 单根语义）：

1. **仅单根生效**：`subTree.type === Fragment`（或嵌套 Fragment）→ 跳过（多根不自动 fallthrough，同 Vue）
2. **排除内部字段**：`key` / `ref` / `children` / `slots`（具名插槽）不落根元素
3. **根元素显式声明优先**：根元素 props 已有该属性（除 class/style）→ 不覆盖（`<button type="button">` 不被外部 `type="submit"` 覆盖）
4. **class / style 合并**：`[根元素已有, 外部].filter(Boolean).join(' ')` —— 保证 `.vp-doc` 前缀样式生效且不丢组件自带 class
5. **事件（onXxx）**：根元素已有 → 跳过（显式优先）；没有 → 落到根元素自动绑定

实现落点：

- `mountComponent.ts` 的 `update()`：render 后合并（首次 + 每次更新自动生效；`patchComponent` 的 props 更新路径天然覆盖 attrs 变化）
- 合并函数放 renderer 或独立模块（**克隆 props 副本**，不污染可复用的 vnode）

### 阶段 2：Vue options 形态（`{ props, setup(props, ctx) }`，按需）

1. `defineComponent` 支持对象参数：`defineComponent({ props: [...], setup(props, ctx) })`；函数形态（现有）自动归一化为「props 白名单为空」
2. **props 白名单分离**：`setup` 只收白名单内属性（Vue 语义）；其余进 `ctx.attrs`（含 `$attrs` 暴露）
3. fallthrough 规则细化：白名单内属性**不** fallthrough；白名单外全量 fallthrough
4. 函数形态（无白名单）兼容策略（二选一，建议 A）：
   - **A（推荐）**：函数形态保持「props 全量 + 全量 fallthrough」现状 —— 向后兼容，`.vp-doc` 场景直接解决；组件内部使用但不声明在根元素的 prop 可能多余落到根元素（Vue 无白名单时也是全部 fallthrough，语义一致）
   - B：函数形态视为「props 全空 + 全部 attrs」—— 更贴 Vue，但**破坏现状**（现有 `function App(props)` 读 props 的地方全部失效）

---

## 5. 关键实现细节与风险

| 点 | 说明 |
|---|---|
| props 副本 | 合并到根的 props 需克隆（`{ ...subTree.props, ...attrs }`），避免改到可复用的 vnode |
| 更新路径 | `updateProps` 增量写 `instance.props` → `instance.update()` → render → 重新合并，attrs 变化自动反映，无需改 `patchComponent` |
| 多根组件 | 不自动 fallthrough —— 文档标注「用 `{...attrs}` 显式绑定到目标元素」（JSX 展开） |
| 条件渲染组件 | `return cond ? <Comp/> : null`（React 惯例，babel-plugin-actview 已支持三元/`&&`）返回单根元素 → fallthrough 正常；若用 `<>...</>` 包裹（Fragment 根）则不透传，与 Vue 一致，需显式 `{...attrs}` |
| 事件覆盖 | 显式优先下「外部 onclick 落到无事件的根元素」✓；「内部已有 onclick」时外部被忽略 —— 与 Vue 的 invoker 并存不同，属可接受差异（边缘场景） |
| 多余属性 | 函数形态下 `<Button type="submit">` 若组件不在根元素用 type，type 会落到根 div（HTML 无效属性但无害）—— 与 Vue 无白名单语义一致 |
| `inheritAttrs: false` | 阶段 2 options 形态时顺带支持（白名单机制的开关） |

---

## 6. 验证测试设计（阶段 1 实施时的用例）

1. `<Content class="vp-doc" />` → 根元素 class 含 `vp-doc`（背景场景）
2. class 合并：内部 `class="a"` + 外部 `class="b"` → 根元素 `a b`
3. 显式优先：内部 `id="x"` + 外部 `id="y"` → 根元素 `id="x"`
4. 普通属性透传：外部 `title` → 根元素有 `title`
5. Fragment 多根：不 fallthrough
6. 更新：外部 class 变化 → 根元素 class 更新（走 `updateProps` → `update()`）
7. 事件透传：外部 `onclick` → 根元素可触发
8. 排除：`key` / `ref` / `children` 不落根元素

---

## 7. 结论

- **阶段 1**（全量 fallthrough + 根元素合并）：约 30 行核心代码即可解决 VitePress 场景，且不破坏任何现有行为
- **阶段 2**（options 形态 + props 白名单）：完整的 Vue 对齐，工作量主要在前置的白名单机制
