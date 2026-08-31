---
"actview": patch
---

修复 `props.children` 在惰性插槽求值期的读取：组件 JSX children 被插件转成惰性插槽对象 `{ default: () => [...] }`，读取点（vnode 创建）延迟到**组件子树渲染时**才执行，本组件词法渲染期标记已失效——此前误判「非渲染期」（警告 + 子内容不渲染）

- `createVNode` 包装新增**插槽求值深度**（wrapSlots）：插槽函数包一层 ++/-- 计数
- children 渲染期判定 = 本组件 render 区间 || 插槽求值深度 > 0（React 语义：JSX 子内容即渲染内容）
