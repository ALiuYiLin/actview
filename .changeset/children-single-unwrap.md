---
"actview": patch
---

`props.children` 单子元素解包（React 对齐）：组件 JSX children 经插槽规范化返回数组，桥接层在**单元素时解包为元素本身**——`<Comp><b>x</b></Comp>` 的 `props.children` 是 b vnode 而非 `[b]`（与 React 一致）；多子元素/空保持数组/null

- 消费方（如 cloneElement 语义的 `isVNode(child) && typeof child.type === 'string'` 重建）可直接按 React 语义处理单元素
- 测试：children-bridge 新增「单子元素解包」用例
