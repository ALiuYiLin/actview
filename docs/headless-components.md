# 无头组件（Headless UI）React → ActView 迁移指南

> 面向 Base UI / Radix 风格的无头组件库迁移：`forwardRef` + `render` prop + state 注入 + ARIA 状态管理。
> 核心转换规则 + 完整示例（Separator）+ render prop 三形态 + 响应式机制。
> 关联：`docs/react-migration.md`（整体迁移）、`plantform-diff.md`（PD-01/02/15 等框架差异）。

---

## 一、无头模式回顾

无头组件库的核心约定：

```tsx
// 库侧：提供默认渲染 + 状态 + ARIA，用户可完全重实现渲染
export const Separator = React.forwardRef(function SeparatorComponent(props, forwardedRef) {
  const { render, orientation = 'horizontal', ...elementProps } = props;
  const state = { orientation };
  return useRenderElement('div', props, {
    state,
    ref: forwardedRef,
    props: [{ role: 'separator', 'aria-orientation': orientation }, elementProps],
  });
});
```

三个机制：
1. **forwardRef** —— 用户 ref 转发到内部真实 DOM
2. **render prop** —— 用户可覆盖渲染（VNode 实例 / 渲染函数，对齐 Base UI 原版），默认实现由库提供
3. **state 注入** —— 组件内部状态（open/checked/orientation…）传给 render 函数，用户 JSX 读取

## 二、核心转换规则（对照表）

| React 写法 | ActView 写法 | 原因 |
|---|---|---|
| `React.forwardRef(fn, forwardedRef)` | 不需要 forwardRef；`rootRef = subTree.el` 推导（onMounted/onUpdated 同步），**ref 契约恒为根 DOM**（组件 VNode 时也指向组件根 DOM，非实例） | PD-02：`<Comp ref={x}>` 时 x 是**组件实例**；无头组件内用 rootRef 恒指 DOM，实例经 `getCurrentInstance()` 获取 |
| setup 顶层解构 `const {render, ...} = props` | **解构放渲染期** `return () => { const {...} = componentProps }` | PD-15：setup 层解构冻结旧值（快照）；渲染期每次更新读最新 props |
| `useRenderElement(defaultTag, props, {state, ref, props})` | 手写两分支：默认 `<Tag>` / `render` 函数 `render({...merged, ...state, ref})` / `render` VNode 实例（复用 type + 合并 props，等价 cloneElement） | Base UI helper 展开为显式逻辑 |
| props 数组合并 `[{role, 'aria-orientation': o}, elementProps]` | `const merged = { role, 'aria-orientation': o, ...elementProps }` | 对象展开 |
| `state` 传给 render 函数 | `render({ ...merged, ...state, ref })` | 与 ActView render-prop 模式一致 |
| `render={<span/>}` 换标签（VNode 实例） | `const Tag = render.type; return <Tag key={render.key} {...render.props} {...merged}/>` | 等价 `cloneElement`：后展开胜（merged 覆盖 render.props）；**key 透传**（VNode.key 在字段不在 props）；ref 不强制覆盖（用户自己的 ref 保留） |

> 决策（2026-08）：**保持 Base UI 原版语义（方案 A）**——`render?: VNode \| ComponentRenderFn`，VNode 实例 + 渲染函数两形态。迁移存量代码大量使用 `render={<span/>}`，与 React 一致、无需改写；`render="span"` 标签简写（方案 B，`<component is>` 统一）留作后续优化。

## 三、完整示例：Separator

### React 源

```tsx
export const Separator = React.forwardRef(function SeparatorComponent(
  componentProps: Separator.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { className, render, orientation = 'horizontal', style, ...elementProps } = componentProps;
  const state: SeparatorState = { orientation };
  const element = useRenderElement('div', componentProps, {
    state,
    ref: forwardedRef,
    props: [{ role: 'separator', 'aria-orientation': orientation }, elementProps],
  });
  return element;
});
```

### ActView 转换

```tsx
import { defineComponent, ref } from 'actview'

export const Separator = defineComponent(function (componentProps: any) {
  // ref 契约恒为根 DOM：不挂模板 ref，rootRef 由 subTree.el 推导
  // （组件 VNode 时也指向组件根 DOM 而非实例；实例用 getCurrentInstance）
  const self = getCurrentInstance() as any
  const rootRef = ref<HTMLElement | null>(null)
  onMounted(() => {
    rootRef.value = self?.subTree?.el ?? null
  })
  onUpdated(() => {
    rootRef.value = self?.subTree?.el ?? null
  })

  return () => {
    // ⚠️ 解构放渲染期——setup 层解构会冻结旧值（PD-15）
    const { render, orientation = 'horizontal', ...elementProps } = componentProps

    const state = { orientation }

    // 元素 props：ARIA 状态 + 用户透传（PD-01：aria-* 布尔值输出 "true"/"false"）
    const merged = {
      role: 'separator',
      'aria-orientation': orientation,
      ...elementProps,
    }

    // render 覆盖（默认 div）——两形态（方案 A，对齐 Base UI）
    if (render) {
      if (typeof render === 'function') {
        // render prop：单 props 对象（元素 props + state + ref 全合并），
        // 与组件 setup 收单个 props 对象的心智模型一致
        return render({ ...merged, ...state, ref: rootRef })
      }
      // render 是 VNode 实例：复用其 type 渲染、合并 props（等价 cloneElement）。
      // 展开顺序：render.props → merged（覆盖）；key 透传（VNode.key 在字段）；
      // ref 不强制覆盖——用户自己的 ref 保留，rootRef 由 subTree.el 推导
      const Tag = render.type as any
      return <Tag key={render.key} {...render.props} {...merged} />
    }
    return <div {...merged} />
  }
})
```

### 用户侧两种用法

```tsx
<Separator orientation="vertical" />                                     // 默认 div
<Separator render={<span class="my-sep" />} />                            // VNode 实例换标签（对齐 Base UI/React）
<Separator render={(props) => <div {...props} class="my-sep" />} />       // 渲染函数完全重实现
```

> 验收测试：`test/headless-separator.test.tsx`（默认渲染 / VNode 实例换标签 / render 函数 / props 响应式，4 用例）+ `test/headless-render-vnode.test.tsx`（VNode 实例形态边界：复用 type + 合并 / children 覆盖 / Fragment / 组件 VNode，4 用例）+ `test/headless-rootref.test.tsx`（ref 契约恒为 DOM：原生元素 / 组件 VNode / 默认元素，4 用例）

## 四、render 两形态（库侧判定，方案 A）

```tsx
// 库侧通用判定模板（任何无头组件的 render 处理）
if (typeof render === 'function') {
  // ① 渲染函数：单 props 对象（元素 props + state + ref 全合并）
  return render({ ...merged, ...state, ref: rootRef })
}
if (render) {
  // ② VNode 实例（render={<span/>}）：复用 type + 合并 props（等价 cloneElement）
  const Tag = render.type as any
  return <Tag key={render.key} {...render.props} {...merged} />
}
// ③ 默认实现
return <div {...merged} />
```

> `render={null}` / 未传 → 走默认实现。类型：`render?: VNode | ComponentRenderFn<RenderFunctionProps, State>`，
> `ComponentRenderFn = (props: RenderFunctionProps & State & { ref?: RefValue }) => VNode | null | undefined`
> （单 props 对象，state 合并进 props——与组件 setup 收单个 props 对象的心智模型一致）。
> `ref` 契约恒为**根 DOM**（`RefValue` 指向 `HTMLElement`）：rootRef 由 `subTree.el` 推导，
> 组件 VNode 时也指向组件根 DOM；组件实例经 `getCurrentInstance()` 获取。

## 五、响应式机制（为什么这样写能自动更新）

1. **props 响应式**：`orientation` 等 prop 在**渲染期**读取 → 追踪组件 render effect → 父更新 props → 自动重渲染（对照 `orientation` 变化的验收用例）
2. **render 函数内读响应式状态**：`render({...})` 在库组件 render effect 里调用 → 用户函数内读取的 ref/reactive 状态被追踪到**库组件**的 render → 状态变化自动重渲染、重新调用 render
3. **state 传递**：state 是每次渲染重建的普通对象（含最新值）；若 state 需被用户**独立追踪**（如 open 状态由用户自己控制），应传 ref/reactive 值而非普通对象

## 六、常见坑（关联 plantform-diff）

| 坑 | 说明 | 条目 |
|---|---|---|
| setup 层解构冻结 | 解构出的 `orientation` 是旧值，父更新不生效 | PD-15（已解决：渲染期解构 / useProps） |
| ref 拿到组件实例 | 用户 `<Separator ref={x}/>` 的 x 是实例不是 DOM | PD-02（待升级：实例根 DOM 访问器）；无头组件内部用 `subTree.el` 推导 rootRef，**ref 契约恒为根 DOM**，实例经 `getCurrentInstance()` |
| aria-* 布尔输出 | `aria-disabled={true}` 输出 `"true"`（已规范化） | PD-01（已实施） |
| onChange 语义 | 原生 change 事件；受控文本输入用 onInput | PD-03 |
| 组件函数只执行一次 | setup 只跑一次，派生逻辑放 computed / 渲染期 | PD-06 |

---

> 维护说明：新增无头组件转换示例时在本文件追加（对照表 + 完整示例 + 验收测试），保持 react-migration.md 聚焦整体迁移。
