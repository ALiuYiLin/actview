# Attribute Fallthrough（非 prop 属性透传）设计方案

> 状态：✅ 已实施（阶段 1 白名单版 + 阶段 2 完整 Vue 对齐）
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

---

## 3. Vue 3 机制对照

| 机制 | Vue 3 行为 | ActView 实现 |
|---|---|---|
| props 白名单 | `props: [...]` / 对象声明；白名单之外的属性进 `ctx.attrs` | ✅ `defineComponent({ props, setup(props, ctx) })`，`ctx.attrs` |
| 单根节点 | attrs 自动合并到根元素（class/style 特殊合并，其余「根元素显式声明优先」） | ✅ `mergeAttrsToRoot(subTree, attrs)` |
| 多根（Fragment） | 不自动 fallthrough，需 `v-bind="$attrs"` 显式绑定 | ✅ 同左 |
| class / style | 归一化合并，组件自带 + 外部共存 | ✅ class 拼接、style 浅合并 |
| 事件（onXxx） | attrs；fallthrough 自动绑定（invoker 机制，组件与外部 handler 并存） | ⚠️ 透传绑定但**根元素显式优先**（invoker 并存列后续，边缘差异） |
| 无 props 声明的组件 | 所有属性都是 attrs → 全部 fallthrough；setup 的 props 为空对象 | ✅ 函数形态保持「props 全量 + attrs 全量」（兼容策略 A）；**Babel 自动提取**（见下）后按白名单分离 |
| `inheritAttrs: false` | 关闭自动透传 | ✅ `defineComponent({ inheritAttrs: false, ... })` |
| 值类型过滤 | Vue 对所有未声明 prop 落根（对象会被 String 化） | ⚠️ ActView 额外过滤：对象/数组/非事件函数不透传（避免 `[object Object]` 污染根元素） |

---

## 4. ActView 实施方案（已实施）

### 阶段 1：attrs fallthrough + 根元素合并（已实施）

`update()` 里 render() 之后、patch 之前：

```
mergeAttrsToRoot(subTree, attrs)
```

合并规则（对齐 Vue 单根语义）：

1. **仅单根生效**：`subTree.type === Fragment`（或嵌套 Fragment）→ 跳过（多根不自动 fallthrough，同 Vue）
2. **排除内部字段**：`key` / `ref` / `children` / `slots`（具名插槽）不落根元素
3. **根元素显式声明优先**：根元素 props 已有该属性（除 class/style）→ 不覆盖（`<button type="button">` 不被外部 `type="submit"` 覆盖）
4. **class / style 合并**：class 拼接、style 浅合并 —— 保证 `.vp-doc` 前缀样式生效且不丢组件自带 class
5. **事件（onXxx）**：根元素已有 → 跳过（显式优先）；没有 → 落到根元素自动绑定

### 阶段 2：options 形态 + props 白名单分离 + 全量透传（已实施）

1. `defineComponent` 支持对象参数：`defineComponent({ props: [...], setup(props, ctx), inheritAttrs? })`，产物 `{ __setup, __props?, __inheritAttrs? }`；函数形态（现有）归一化为「props 白名单为空」
2. **props 白名单分离**（`splitProps`）：声明内 → `setup(props)`；声明外 → `ctx.attrs`（含 `$attrs` 语义）
3. **attrs 全量透传**（移除阶段 1 的白名单）：`mergeAttrsToRoot` 对 attrs 不再白名单过滤，改为**值类型过滤**（`isPassThroughValue`）—— string/number/boolean、style 对象、on* 事件函数透传；其余对象/数组/函数跳过
4. 函数形态（无白名单）兼容策略 A：props 全量（现有 `setup(props)` 读取不变）+ attrs 同全量（fallthrough 用）
5. `inheritAttrs: false`：`__inheritAttrs === false` 时跳过自动合并（attrs 仍在 `ctx.attrs` 供显式 `{...ctx.attrs}` 绑定）
6. **更新链路**：`patchComponent` 增量更新 props（引用稳定，setup 闭包安全）+ `collectAttrs` 重算增量更新 attrs；`propsChanged || attrsChanged` 任一变化触发 `instance.update()`（attrs-only 变化——options 形态下仅外部属性变化——也必须重渲染，否则根 DOM 属性陈旧）
7. **Babel 自动 props 提取**（babel-plugin-actview）：从组件函数第一个参数**自动**生成 props 白名单，无需手写 options 形态——见下文「自动 props 提取」

### 阶段 2.5：Babel 自动 props 提取（已实施）

用户无需手写 `defineComponent({ props, setup })`，写普通函数即可，Babel 编译期自动提取：

```tsx
// 源码（无需 import defineComponent）
function Box(props: { label: string }, ctx?: any) {
  return <div title={ctx?.attrs?.note}>{props.label}</div>
}
// 或解构写法
function Box({ label }: { label: string }, ctx?: any) { ... }
```

```js
// Babel 自动产物
const Box = defineComponent({
  props: ["label"],
  setup: function (props: { label: string }, ctx?: any) { ... }
})
```

提取来源（`extractPropsFromType`）：
- **TS 类型注解**（内联对象类型字面量）：`props: { x1: string, x2?: number }` / `{ x1 }: { x1: string }` → `['x1', 'x2']`
- **解构参数**（无类型注解）：`{ x1, x2 }` → `['x1', 'x2']`

回退函数形态（props 全量）：
- `props: any`、类型别名引用（`MyProps`，Babel 无类型检查器无法跨文件解析）、无参数
- 解构带 rest（`{ x1, ...rest }`）：白名单会截断 rest 的运行时内容，保守回退
- **esbuild/rolldown 先转**（类型与解构已剥离）→ 自动回退（best-effort）

配套类型（jsx/global.ts）：
- `JSX.LibraryManagedAttributes<C, P> = P & Record<string, any>`：组件元素 JSX 属性允许 props 白名单外的 attrs（class、style、data-*、on*），声明内属性仍做必填/类型检查
- 裸函数组件的 `ctx` 第二参建议写**可选**（`ctx?: any`）——JSX 组件类型要求单参可调用
7. **scoped 集成**：`data-v-*`（scoped hash）在 attrs 中 → 全量透传落子组件根元素，实现「子 root 继承父 scopeId」；多级嵌套经组件 props 链逐级累积（对齐 Vue）

---

## 5. 关键实现细节与风险

| 点 | 说明 |
|---|---|
| props 副本 | 合并到根的 props 克隆（`{ ...subTree.props }`），避免改到可复用的 vnode |
| 更新路径 | `patchComponent`：`updateProps(instance.props, ...)` 增量写 + `collectAttrs` 重算 attrs 增量写 → `instance.update()` → render → 重新合并 |
| 多根组件 | 不自动 fallthrough —— 文档标注「用 `{...attrs}` 显式绑定到目标元素」（JSX 展开） |
| 条件渲染组件 | `return cond ? <Comp/> : null` 返回单根元素 → fallthrough 正常；`<>...</>`（Fragment 根）不透传，与 Vue 一致 |
| 事件覆盖 | 显式优先（内部已有 onclick 时外部忽略）—— 与 Vue invoker 并存不同，可接受差异 |
| 多余属性 | 函数形态下 `<Button type="submit">` 若组件不在根元素用 type，type 落到根 div（HTML 无效属性但无害，同 Vue 无白名单语义） |
| 值类型过滤 | 业务 props（对象/数组，如 `features={[...]}`）不透传，避免 `[object Object]` 污染根元素——与 Vue 的差异点（Vue 全落根） |
| 函数形态 props | 保持全量（向后兼容），attrs 同全量；有类型注解/解构时 Babel 自动提取白名单（无需手写 options 形态） |

---

## 6. 验证测试（已实施，scripts/verify.test.tsx 场景 27，15 用例）

1. `<Content class="vp-doc" />` → 根元素 class 含 `vp-doc`（背景场景）
2. class 合并：内部 `class="a"` + 外部 `class="b"` → 根元素 `a b`
3. 显式优先：内部 `id="x"` + 外部 `id="y"` → 根元素 `id="x"`；`type="button"` 不被外部覆盖
4. 标量 attrs 全量透传：外部 `title`/`data-x` → 根元素有
5. Fragment 多根：不 fallthrough
6. 更新：外部 class 变化 → 根元素 class 更新（走 `updateProps` → `update()`）
7. 事件透传：外部 `onclick` → 根元素可触发
8. 排除：`key` / `ref` / `children` 不落根元素
9. 业务 props（对象/数组）不透传：根元素无 `features` 属性
10. options 形态 props 分离：声明内进 `setup(props)`、声明外（`id`/`data-k`）落根
11. `inheritAttrs: false`：未显式绑定不透传；`{...ctx.attrs}` 显式绑定生效
12. scoped 继承：`data-v-*` attrs 落子 root，多级嵌套逐级累积

---

## 7. 结论

- **阶段 1**（attrs fallthrough + 根元素合并）：解决 VitePress 场景，不破坏现有行为
- **阶段 2**（options 形态 + props 白名单 + 全量透传 + 值类型过滤 + inheritAttrs）：完整 Vue 对齐（差异点：事件显式优先、值类型过滤、函数形态 props 兼容策略 A 均文档化）
- **阶段 2.5**（Babel 自动 props 提取）：类型注解 / 解构参数自动生成 props 白名单，无需手写 options 形态（rest/别名/esbuild 先转自动回退）
