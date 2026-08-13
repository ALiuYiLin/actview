# ActView 框架能力清单

## 响应式 API
- `ref` / `isRef` / `unref` / `toRef` / `toRefs`
- `reactive` / `shallowReactive` / `readonly` / `markRaw`
- `computed`（只读 getter / 可写 getter+setter）
- `watch` / `watchEffect`（清理回调、watch 选项）
- 深度响应式：嵌套对象、数组方法、`for...in` 遍历全部响应式
- 调度系统：依赖收集（track / trigger）、批处理队列（queueJob）、`nextTick`

## 组件能力
- `createApp().mount()` 应用入口
- `defineComponent`：函数形态 + options 形态（props 白名单分离）
- 生命周期钩子：`onMounted` / `onUpdated` / `onBeforeUnmount` / `onUnmounted`
- `getCurrentInstance`
- Props / attrs：事件透传（onXxx、onClickCapture、小写 onclick）、attr 自动合并到根元素（`inheritAttrs`）
- 插槽：默认插槽（children）、具名插槽（template slot="name"）、作用域插槽（函数 children / render-prop）
- 模板引用 `ref`（函数或 `{ value }` 对象）
- 动态组件 `<component is={...}>`
- `KeepAlive` 组件缓存
- `ErrorBoundary` 错误边界（fallback 可函数化接收错误）
- `Suspense` + `lazy()` 异步组件（fallback 占位）
- `Teleport` 传送门
- `Transition` 过渡动画（enter / leave、CSS duration 检测、显式 duration）
- `Fragment` 片段
- `EffectScope` / `getCurrentScope`

## JSX 与类型
- JSX 扩展语法（`@actview/jsx`：jsx / jsxs / jsxDEV / createElement / isValidElement）
- 全局 JSX 类型增强（JSX.IntrinsicElements、jsxImportSource）
- 事件 props 与 DOM 事件名自动映射

## 渲染器
- 虚拟 DOM + patch（mount / update / unmount）
- keyed diff：LIS 最长递增子序列最小移动（参考 Vue 3）
- 文本节点、input value 同步（selection 保持）
- `renderToString`（VNode → HTML 静态序列化）
- 运行时短路：patchProps 值比较 / props 引用 / children 引用短路
- `v-memo`：行级显式依赖短路（deps 未变整棵子树复用）

## 双模细粒度（`<solid>`）
- `<solid>` 编译期作用域标签：块内 JSX 编译为 DOM 直连 effect（骨架创建一次、`{expr}` 独立 effect），块外保持 Vue 式 re-render
- 集合更新：`mapArray` 项级 keyed 复用（公共前后缀跳过 + LIS 最小移动 + 顺序未变零移动）
- 运行时：`solidGet` / `createEffect` / `mapArray`（effect 归 EffectScope 统一清理）

## 构建期与生态
- `@actview/router`：createRouter、createWebHistory / createMemoryHistory、RouterLink、RouterView、路由匹配
- `@actview/plugin-vite`：Vite 插件（defineComponent 转换接入）
- `@actview/babel-plugin-actview`：Babel 编译期组件自动 defineComponent 转换（含 template 具名插槽转换）
- `@actview/plugin-scoped`：scoped CSS（data-v 属性哈希 + 样式处理 + Vite 插件）
- `@actview/create-cli` 脚手架
- TypeScript 支持（tsup 构建、d.ts 类型导出）
