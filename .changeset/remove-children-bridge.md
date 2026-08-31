---
"actview": major
---

children 桥接重构（React 对齐）：渲染期求值 + createVNode 包装抽三参

- `defineComponent` 桥接的 `props.children` 改为**渲染期求值**：
  渲染函数执行期间读取 = `slots.default()` 求值（值语义，与 React 一致）；
  非渲染期读取 = undefined + 一次性提示（不执行——避免「Slot invoked
  outside of render function」警告与依赖丢失）；判断有无子内容用
  `props.slots.default != null`（静态检查，任何时机安全）
- 桥接包装 render 函数维护渲染期标记（标记区间 = vue 渲染调用链内，
  与 currentRenderingInstance 上下文同步）
- **createVNode 包装**（actview 导出，plugin-jsx 产物默认 import actview）：
  `<p {...props}>` 展开的 children 键运行时抽进第三参（React 对齐）；
  JSX 显式 children 优先；单个 vnode children 包数组（对齐 h()）
- 桥接虚拟键（children/slots）不再参与 ownKeys/descriptor——展开、
  Object.keys、toRefs 遍历不带桥接键（vue 的 slots 机制不走 props）
- 组件 props 类型不再自动含 children（JSX children 属性仍来自全局
  IntrinsicAttributes）；使用 slots 的组件类型需声明 slots?: any
