# Base UI React → ActView 框架差异记录（Platform Diff）

> 目的：记录 **React 与 ActView 框架行为差异**（编号 PD-NN），以及**为保持现有功能所做的适配说明**（编号 AD-NN）。
> 每个 PD 条目格式：编号 / 标题 / 场景 / 代码示例 / 渲染后示例（或行为对比）。
> 新差异持续追加；适配随代码演进更新。

---

## 第一部分：框架差异（Platform Diff）

### PD-01 aria-* 布尔属性渲染
// ✅ 已解决（框架侧已修复）：setProp 对 aria-*/data-* 键布尔值规范化（true→"true"、false→"false" 不移除，对齐 ARIA 规范与 React）；renderToString 同步
- **标题**：aria-* 布尔属性的渲染值不同
- **场景**：`aria-disabled`、`aria-checked`、`aria-required` 等布尔型 ARIA 属性
- **代码示例**：
  ```tsx
  // React（源）
  <button aria-disabled={disabled} />
  ```
- **历史行为（修复前，仅存档）**：ActView `<button aria-disabled="">`（setProp 统一处理：`true → setAttribute(key,'')`，`false → removeAttribute`），不符合 ARIA 规范（规范要求 "true"/"false"）
- **现状（已修复）**：ActView 与 React 一致——`<button aria-disabled="true">`（布尔值字符串化；false 渲染为 `"false"` 不移除）；renderToString 同步规范化
- **适配**：无需适配——库代码可直接传布尔值，不必再手工转字符串（历史写法 `aria-disabled: disabled ? 'true' : undefined` 已无必要）。相关文件：`useFocusableWhenDisabled` 等。
- **状态**：已解决（issue #20）。验收测试：`test/platform-diff.test.tsx`（PD-01/19：aria-*/data-* 布尔规范化）、`test/state-attributes.test.tsx`

### PD-02 组件级 ref 指向组件实例（设计语义，非缺陷）
// ✅ 定性修正：ref=组件实例是**有意设计**（对齐 Vue 语义），行为正确，不是错误/待修复项。需要根 DOM 时首选自行转发 ref；useRootElement() 仅为备选（尽力不用，该 API 后续可能移除）
- **标题**：组件的 `ref` prop 指向**组件实例**而非根 DOM 元素（设计语义）
- **场景**：用户给组件传 `ref`（如 `<Button ref={el => ...}/>`）；actview 的 mountComponent 在 setup 执行**前** `delete props.ref`，并把 ref 回调以**组件实例**调用
- **代码示例**：
  ```tsx
  <Button ref={(node) => (instance = node)} />
  ```
- **渲染后示例**：React 的 `node` 是 `<button>` DOM 元素；ActView 的 `node` 是内部组件实例对象（无 tagName）——**行为正确**，与 Vue「组件 ref 拿实例」语义一致
- **适配（需要根 DOM 时的做法）**：
  - **首选：自行转发 ref**——子组件内部把 `props.ref` 绑定到根元素上：`<div ref={props.ref}>`（Base UI 风格组件经 `useRenderElement` 的 `params.ref` 透传，内部 useMergedRefs 合并挂到渲染元素，见 AvatarRoot/CheckboxRoot）
  - 备选：`useRootElement()`（封装 subTree.el 推导 + 生命周期同步，根为组件时也指向最终根 DOM）——**尽力不用**，该 API 后续可能移除
- **状态**：设计语义确认，非缺陷（原记录见 issue #21）

### PD-03 onChange 语义
// TODO 框架侧（评估）：文档/类型层提示"受控文本输入用 onInput"；可选提供 React 兼容的 onChange→input 映射（仅文本类 input，checkbox/radio/select 保持原生 change）
- **标题**：`onChange` 是原生 `change` 事件（React 的 onChange = input 事件，每次输入都触发）
- **场景**：受控文本框（input/combobox/number-field 等）的值变化监听
- **代码示例**：
  ```tsx
  <input onChange={handler} />   // React：每次输入触发
  ```
- **渲染后示例**：React 输入 "abc" 触发 3 次 onChange；ActView 只有失焦/回车才触发 change
- **适配**：受控文本输入统一改用 `onInput`（每次输入触发）；checkbox/radio/select 的 onChange 原生语义正确无需改

### PD-04 无合成事件
// TODO 保持：无合成事件是设计取舍（原生事件，文档已覆盖），无需框架改动
- **标题**：事件是**原生 DOM 事件**，无 React 合成事件包装（无池化、无 `event.nativeEvent`）
- **场景**：任何事件处理（`event.nativeEvent`、`event.currentTarget` 类型）
- **代码示例**：
  ```tsx
  // React
  onClick={(e) => e.nativeEvent.defaultPrevented}
  // ActView
  onClick={(e) => e.defaultPrevented}   // e 就是原生事件
  ```
- **适配**：删除所有 `event.nativeEvent` 用法；`React.MouseEvent` 等类型改原生类型

### PD-06 组件函数只执行一次（setup）
// TODO 保持：setup+render 是核心设计；PD-15 的 props 解构已由 useProp/useProps 解决
- **标题**：组件函数体只执行一次（setup），返回的 JSX 被包成 render 函数每次更新执行
- **场景**：派生逻辑、props 对象构造、条件渲染的位置
- **代码示例**：
  ```tsx
  function App() {
    const count = ref(0)
    function inc() { count.value++ }
    return <div onClick={inc}>{count.value}</div>   // ② render：每次更新执行
  }
  // 编译后
  const App = defineComponent(function () {
    const count = ref(0)                            // ① setup：只执行一次
    return () => <div onClick={inc}>{count.value}</div>
  })
  ```
- **适配**：派生值用 `computed`；props 对象构造放 getter（`getXxxProps()` 在 JSX 内调用）；setup 层禁止解构 props（PD-17）

---

