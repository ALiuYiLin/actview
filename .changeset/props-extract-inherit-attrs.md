---
"@actview/plugin-jsx": minor
"actview": minor
---

编译期 props 提取 + 自动落根（属性透传）

- `@actview/plugin-jsx`：组件函数第一参类型注解经 `@vue/compiler-sfc` 的 `extractRuntimeProps` 降级为运行时 props 声明，注入 `defineComponent(fn, { props })`（auto-define 包装与显式 `defineComponent` 均支持；`children` 自动剔除；类型不可解析时 warn 跳过）
- `actview`：`defineComponent(setup, options?)` 支持 `{ name, props }`；有 props 声明时开启 `inheritAttrs`——未消费 attrs（class / data-* / 事件 / 透传属性）自动落到根元素，scoped 注入的 `data-v-*` 对 actview 组件生效；无声明时维持不透传（React 语义）
