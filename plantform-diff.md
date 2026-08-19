# Base UI React → ActView 框架差异记录（Platform Diff）

> 目的：记录 **React 与 ActView 框架行为差异**（编号 PD-NN），以及**为保持现有功能所做的适配说明**（编号 AD-NN）。
> 每个 PD 条目格式：编号 / 标题 / 场景 / 代码示例 / 渲染后示例（或行为对比）。
> 新差异持续追加；适配随代码演进更新。

---

## 第一部分：框架差异（Platform Diff）

### PD-01 aria-* 布尔属性渲染
// ✅ 已实施：setProp 对 aria-* 键布尔值规范化（true→"true"、false→"false" 不移除，对齐 ARIA 规范与 React）；renderToString 同步
- **标题**：aria-* 布尔属性的渲染值不同
- **场景**：`aria-disabled`、`aria-checked`、`aria-required` 等布尔型 ARIA 属性
- **代码示例**：
  ```tsx
  // React（源）
  <button aria-disabled={disabled} />
  ```
- **渲染后示例**：
  - React：`<button aria-disabled="true">`（布尔值字符串化；false 渲染为 `"false"` 不移除）
  - ActView：`<button aria-disabled="">`（setProp 统一处理：`true → setAttribute(key,'')`，`false → removeAttribute`）——不符合 ARIA 规范（规范要求 "true"/"false"）
- **适配**：库代码把 `aria-*` 布尔值输出为字符串，如 `aria-disabled: disabled ? 'true' : undefined`（actview 对字符串原样输出）。相关文件：`useFocusableWhenDisabled` 等。
- **状态**：已记录，待执行方案 B（规范化）或保持（测试按存在性断言，见 issue #20）

### PD-02 组件级 ref 指向组件实例
// TODO 框架侧（可选）：组件实例暴露根 DOM 访问器（如 instance.rootEl = subTree.el）或 Vue 式 expose() 等价物，减少"拿根元素需内部 ref/DOM 查询"的负担；保持 ref→组件实例语义
- **标题**：组件的 `ref` prop 指向**组件实例**而非根 DOM 元素
- **场景**：用户给组件传 `ref`（如 `<Button ref={el => ...}/>`）；actview 的 mountComponent 在 setup 执行**前** `delete props.ref`，并把 ref 回调以**组件实例**调用
- **代码示例**：
  ```tsx
  <Button ref={(node) => (instance = node)} />
  ```
- **渲染后示例**：React 的 `node` 是 `<button>` DOM 元素；ActView 的 `node` 是内部组件实例对象（无 tagName）
- **适配**：DOM 引用通过 ① render 元素 ref（`render={<button ref={...}/>}`），② 组件内部 ref（如 useButton 的 buttonRef），③ 直接 DOM 查询
- **状态**：已记录（issue #21）

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

### PD-05 class / className
// TODO 保持：class/className 双支持已满足（SVG 走 setAttribute），无需改动
- **标题**：`class` 与 `className` 都映射到元素 className（SVG 走 setAttribute）
- **场景**：样式类传递
- **代码示例**：`<div class="a" className="b" />`
- **渲染后示例**：两者都生效，`className` 属性名原样保留在 props 上也被正确映射
- **适配**：公共 props 名保留 `className`（React 兼容）；内部统一用 `class`

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

### PD-07 组件必须以 return JSX 结尾（babel 转换）
// ✅ 已实施（对齐 renderToString，非全自动解包）：isComponentVNode 接受函数类型；挂载时调一次 fn(props)：返回函数→作 render（手动 setup 风格可用）；返回 VNode→明确报错替代 InvalidCharacterError
- **标题**：babel 转换只把「最后 return 为 JSX/null/含 JSX 的三元」的组件包成 defineComponent；`return getElement()`（调用表达式）不转换 → 裸函数进入运行时崩溃
- **场景**：任何组件函数
- **代码示例**：
  ```tsx
  // ❌ 不转换（运行时崩）
  return getElement()
  // ✅ 转换
  return <>{getElement()}</>
  ```
- **适配**：所有组件统一 `return <>{getElement()}</>`（issue #19）

### PD-08 JSX 标签不支持成员表达式 / 动态组件
// TODO 已支持：本仓库 babel 插件编译 JSXMemberExpression（Avatar.Root + 具名插槽已验证通过）；该条目应属 oxc 工具链路径，确认后更新/移除
- **标题**：JSX 标签不支持成员表达式 `<A.b />`（oxc 解析器拒绝）；动态组件用内置 `<component is={Comp} />`
- **场景**：动态渲染不同组件
- **代码示例**：
  ```tsx
  // ❌ 解析错误
  <Current.value {...state} />
  // ✅ 动态组件（is 在 render 内求值，天然响应）
  <component is={Current.value} {...state} />
  ```
- **渲染后示例**：成员表达式报 `Expected '>' but found '{'`；`<component is>` 正确渲染目标组件

### PD-09 含 JSX 的文件必须 .tsx
// ✅ 已实施：@actview/plugin-vite transform 扩展 .ts（含 JSX 时同样转换；无 JSX 的 .ts 经 babel 原样再生）
- **标题**：`.ts` 文件中的 JSX 不被 vite oxc 处理（actview 插件只转 .tsx/.js）
- **场景**：非组件文件含 JSX（如 createContext.tsx、测试工具）
- **适配**：含 JSX 一律 `.tsx` 后缀

### PD-10 store 订阅返回 Ref
// TODO 保持：Ref 返回是响应式设计（JSX 需 .value，与全框架一致）；可选在 @actview/store 提供解包便捷 API
- **标题**：`store.use(selector)`（原 useSyncExternalStore 等价物）返回 `Ref`，需读 `.value`
- **场景**：所有 store 状态读取
- **代码示例**：`const open = store.useState('open')` → 渲染内 `open.value`
- **适配**：全局统一 `.value` 读取

### PD-11 useId 无 SSR 稳定 id
// ✅ 已实施：useId() 基于组件实例自增 id（mountComponent uid，setup 只跑一次→重渲染间稳定）+ 调用计数；SSR/setup 外回退全局计数（无水合，服务端/客户端无需一致）
- **标题**：actview 无 React.useId 的 SSR/hydration 稳定 id 等价物（进程内自增）
- **场景**：组件生成 id（useId/useBaseUiId）
- **适配**：JSDoc 注明 SSR 下 id 可能与客户端不一致；label id 在 setup 读一次

### PD-12 useIsoLayoutEffect 无 layout 阶段
// TODO 框架侧（评估）：增加 layout 阶段能力（如 watch flush:'layout' 在 DOM 提交前调度，或 onBeforeUpdate 钩子）；当前 onMounted 同步执行 + watch immediate 方案可先用
- **标题**：actview 无 layout phase，`useIsoLayoutEffect` 等价于 onMounted（挂载后执行）
- **场景**：需要在 DOM 提交前测量/写样式的场景
- **适配**：挂载后同步执行；需要响应 deps 的场景用 `watch(..., {immediate:true})`

### PD-13 useForcedRerendering 不存在
// TODO 框架侧（可选）：新增 useForceUpdate() 帮助函数（内部 tick ref，渲染表达式内读取建立依赖）
- **标题**：actview 无 forceUpdate（`setState({})` 等价物）
- **场景**：依赖外部变化强制重渲染（TabsIndicator、NumberFieldRoot）
- **适配**：本地 tick ref 模式：
  ```tsx
  const tick = ref(0)
  const rerender = () => { tick.value++ }
  // 在 render 表达式/getter 内读一次 tick.value 建立依赖
  ```

### PD-14 reactive 不能整体重赋值
// TODO 保持：与 Vue 一致（reactive 变量重赋值丢代理），文档已覆盖；无框架改动
- **标题**：`reactive` 变量整体重新赋值会丢代理
- **场景**：`state = {...}` 模式
- **适配**：改属性，或整体替换用 `ref({...})` + `.value = {...}`

### PD-15 props 原地更新，setup 解构冻结
// TODO 已解决：useProp/useProps（ComputedRef 活引用 + normalize 默认值 + key:undefined 裸透传 + rest 动态透传，组件内单参形式）——更新本条目的适配说明
- **标题**：props 是 shallowReactive 代理，父更新时原地写（updateProps）；setup 层解构 props 会捕获旧值
- **场景**：任何 props 读取
- **代码示例**：
  ```tsx
  // ❌ setup 解构：父更新后不刷新
  const { count } = props
  // ✅ render/getter 内读
  props.count
  ```
- **适配**：getter/JSX 内读 `props.x`；rest props 用 `getElementProps()` 函数内解构

### PD-16 测试 API 差异
// ✅ 已实施：@actview/testing 的 render(Component, { props }) 支持 props（内部 Harness + reactive 代理），rerender(props) 更新触发响应式重渲染
- **标题**：`@actview/testing` 的 `render(组件)` 不接受 props；`getByText` 返回**最外层**包含匹配的元素
- **场景**：测试编写
- **代码示例**：`render(Component)` → 传 props 需 Harness 组件
- **适配**：测试基建 `test/createRenderer.tsx`（reactive props 的 Harness + setProps/rerender）；查询优先 `getByTestId`

### PD-17 事件处理器逆变（无 bivariance）
// ✅ 已实施：EventHandler 加 bivarianceHack（`{ bivarianceHack(e: E): void }['bivarianceHack']`）——仅放宽赋值方向、保留 E 精确类型；纯类型层，与原生事件设计（PD-04）无冲突
- **标题**：actview 的 `EventHandler<E>` 是逆变函数属性（React 用 bivarianceHack）
- **场景**：`WithBaseUIEvent` 包装的 handler 与原生元素 props 类型不兼容
- **适配**：`HTMLProps` 把 `on*` 键用模板索引重声明为宽松类型（`[key: \`on${string}\`]: ((event: any) => any) | undefined`）

### PD-18 类型来源
// ✅ 已实施：actview 聚合包补导类型（Ref/ComputedRef/WritableComputedRef/ComputedOptions/WatchSource/WatchOptions/Context 等）；core 补导 WatchSource/WatchOptions/WatchCleanup
- **标题**：`actview` 聚合包不导出类型（Ref/ComputedRef/WatchSource 等）
- **场景**：类型导入
- **适配**：类型一律 `from '@actview/core'`

### PD-19 布尔 true 属性的 data-* 输出
// ✅ 已实施：与 PD-01 一并规范化（aria-*/data-* 布尔键：true→"true"、false→"false" 不移除）——统一 setProp 布尔策略
- **标题**：`data-*` 等普通属性的布尔值：actview `true → ""`（React 的 data-* 布尔会字符串化 "true"）
- **场景**：`getStateAttributesProps` 生成的 data-* 状态属性（data-disabled 等）
- **渲染后示例**：React `<div data-disabled="true">`；ActView `<div data-disabled="">`
- **适配**：无（状态属性只需存在性；与 PD-01 同源，可一并规范化）

### PD-20 生命周期顺序
// TODO 保持：子先父后对齐 Vue 3 语义（与 React 相反），文档说明；无框架改动
- **标题**：onMounted 在首次渲染后**同步**触发，子组件先于父组件
- **场景**：依赖挂载时机的逻辑
- **适配**：与 React 相反（React 父先子后）；依赖顺序的逻辑需按 actview 语义调整

### PD-21 渲染错误处理
// TODO 保持：Vue 风格错误处理（onErrorCaptured → ErrorBoundary → console.error），文档说明；无框架改动
- **标题**：渲染错误走 onErrorCaptured 链 → ErrorBoundary → console.error（React 默认 throw）
- **场景**：渲染期异常
- **适配**：需要自定义处理时用 ErrorBoundary

### PD-22 JSX 组件标签的 props 校验限制
// TODO 框架侧：@actview/jsx 组件 props 类型放宽（支持函数式 className/style 等自定义类型），或提供类型级"宽松展开"选项（对齐 HTMLProps 模板索引方案）
- **标题**：用 JSX 组件标签 `<Comp {...props} />` 展开全量 props 时，TS 校验会强制 `className`/`style` 等为原始 DOM 类型，与 Base UI 的函数式 `className`（`(state) => string`）冲突
- **场景**：包装组件（如 Input 包 FieldControl）直接 spread 用户 props
- **代码示例**：
  ```tsx
  // ❌ TS2322：className 函数类型与 HTMLAttributes 不兼容
  return <FieldControl {...props} />
  // ✅ 用 createElement 绕开 JSX 元素校验
  return <>{createElement(FieldControl, props)}</>
  ```
- **适配**：包装类组件统一 `createElement` + Fragment 返回（组件内部不受影响，因为 useRenderElement 走宽松 HTMLProps）

### PD-23 defaultValue 属性行为
// ✅ 已实施：setProp 对 defaultValue/defaultChecked 走 property 赋值（el.defaultValue/el.defaultChecked）；renderToString 序列化映射 defaultValue→value、defaultChecked→checked（对齐 React SSR）
- **标题**：actview 渲染器把 `defaultValue` 当普通属性 setAttribute（不设置 input 的 `.value` 属性）；React 以属性赋值（`.defaultValue`）实现
- **场景**：受控/非受控 input 的 defaultValue
- **渲染后示例**：React `<input>` 显示 defaultValue 值；ActView 仅 DOM 有 `defaultvalue` 属性、input.value 为空
- **适配**：FieldControl 的 input ref 回调里对非受控 defaultValue 直接赋值 `node.defaultValue = String(v)`

### PD-24 `<component is>` 动态组件残留 `is`
// ✅ 已实施：resolveDynamicVNode 解析后删除 vnode.props.is（keepAlive 在 render 期先读 props.is、每次新 vnode，先读后删安全）
- **标题**：`<component is={Comp}/>` 会把 `is` 键残留进组件 props（Base UI 无 `is` 语义）
- **场景**：测试基建里切换当前渲染的组件
- **代码示例**：
  ```tsx
  <component is={Current.value} {...state} />  // props 里会出现 is
  ```
- **适配**：createRenderer 改用 `createElement(Current.value, state)`（PD-24 于 createRenderer 注释中引用）

### PD-25 对象 style 渲染丢弃 `--*` 自定义属性键
// ✅ 已实施：setProp 的 style 对象处理支持 CSS 变量（--* 键走 el.style.setProperty(key, value)，其余 camelCase 键走 el.style[key]）
- **标题**：actview 渲染对象 style 时过滤 `--*`（CSS 变量）键；字符串 style 可完整保留，但与对象 style 合并（mergeObjects）会破坏
- **场景**：scroll-area 的 corner/thumb/overflow 尺寸通过 CSS 变量传递（`--scroll-area-corner-height` 等）
- **代码示例**：
  ```tsx
  // 对象形式：--foo 被过滤
  <div style={{ position: 'relative', '--foo': '3px' }} />
  // 渲染后：style="position: relative;"
  // 字符串形式：完整保留（但无法与对象 style 合并）
  <div style="--foo: 3px; position: relative;" />
  ```
- **适配**：scroll-area 用命令式 `element.style.setProperty('--xxx', value)` + `watch`/`onMounted` 应用（Root 的 corner vars、Scrollbar 的 thumb var、Viewport 的 overflow 距离 vars）；消费方以 `var(--xxx)` 作为 style **值**渲染（值字符串不受影响）。相关文件：ScrollAreaRoot/ScrollAreaScrollbar/ScrollAreaViewport

### PD-26 pointerenter / pointerleave 不冒泡
// TODO 框架侧（评估）：事件系统为 pointerenter/pointerleave 模拟冒泡（React 合成事件语义；原生不冒泡）——或文档明确用 pointermove 替代
- **标题**：原生 `pointerenter`/`pointerleave` 不冒泡（React 合成事件模拟为可冒泡），挂在祖先上的处理收不到子元素的 enter/leave
- **场景**：ScrollArea.Root 把 onPointerEnter/onPointerLeave 挂在 root div，子元素（viewport）进入/离开时 root 收不到事件
- **代码示例**：
  ```tsx
  <div onPointerEnter={fn}>      // root
    <div />                      // viewport：pointerenter 不冒泡，root 收不到
  </div>
  ```
- **适配**：scroll-area 依赖冒泡的 `onPointerMove`（pointermove 冒泡）更新 hovering 状态；测试用 pointerMove/在 root 上派发 pointerLeave 验证（见 ScrollAreaScrollbar.test.tsx 注释）

---

## 第二部分：适配说明（Adaptation Notes）

### AD-01 useRegisteredLabelId 的 WeakMap 语义
- **适配**：react 版用函数式 setState 区分"old label 的 cleanup 不清掉 newer label"；actview 的 setter 是普通写入函数，无法读当前值 → 用模块级 `WeakMap<Function, string|undefined>`（键为 setter）记录最后注册 id，cleanup 仅在匹配时清空，精确复现原语义

### AD-02 测试渲染器（createRenderer）
- **适配**：`render(Component, props)` 通过 reactive props + Harness + `<component is>` 实现 React 的 rerender/setProps 语义；setProps 用 `Object.assign` + nextTick

### AD-03 fireEvent 门面
- **适配**：testing-library 风格的事件触发（click/keyDown/input 等 40+ 方法），内部构造原生 DOM 事件派发

### AD-04 mergeProps 的 preventBaseUIHandler
- **适配**：actview 无合成事件，`isSyntheticEvent` 判断改为"任何对象事件"都挂 `preventBaseUIHandler`，保留"右至左执行 + 可取消"语义

### AD-05 cloneVNode
- **适配**：用 `createElement(vnode.type, {...vnode.props, ...props})` 实现 React.cloneElement 等价物（useRenderElement 内）

### AD-06 useStore 订阅同步
- **适配**：`store.subscribe` 回调里重算 selector，`Object.is` 比较后才写 shallowRef，保留 useSyncExternalStore 的"快照未变不重渲染"语义；selector 参数支持 Ref（unref 后求值）

### AD-07 useControlled
- **适配**：返回带 `setValueIfUncontrolled` 属性的 ComputedRef（读 `.value`、写 `setValueIfUncontrolled(v)`）；受控/非受控模式在 setup 确定一次，切换警告用 watch

### AD-08 本地 tick ref（替代 useForcedRerendering）
- **适配**：`const tick = ref(0); rerender = () => tick.value++`；渲染内读一次 `tick.value` 建立依赖

### AD-09 工程接线
- **适配**：pnpm `link:` 协议以包目录为基准解析（`../../../actview/...`）；解决方案 tsconfig `"files": []`；`jsxImportSource: "@actview/jsx"`；vitest 独立 defineProject + actviewPlugin

### AD-10 类型先行抽取
- **适配**：field/root/FieldRoot.ts、useFieldValidation.ts、form/index.ts 先以「仅类型」抽取落地（解除循环依赖），组件实现阶段补全

### AD-11 prehydration 脚本
- **适配**：tabs/slider 的 prehydrationScript.min.ts 原样复制；actview 无 React 19 的 hydration 等价，脚本仅保留 SSR 语义（SSR 分支用 `typeof document === 'undefined'` 常量）

### AD-12 弹层 Portal 层叠
- **适配**：react 的 `FloatingPortal`（含 tabbable 逻辑）用 `floating-ui-actview` 的 FloatingPortal；轻量场景用 `FloatingPortalLite`（`<Teleport to={portalNode}>`），两者都以 `useFloatingPortalNode` 为内核

### AD-13 watch 的 source 用标量/引用稳定值
- **适配**：actview 的 `watch` 对 source 按**引用**比较；从 context computed 里取对象字面量（如 `overflowEdgeThreshold`、`thumbSize`）会因 context 每次重算产生新引用而反复触发 → 死循环。watch 一律监听**标量 getter/computed**（`() => root.value.hiddenState.y`）或引用稳定的 ref。相关文件：ScrollAreaViewport/ScrollAreaScrollbar

### AD-14 ref 赋值保护（同引用也触发渲染）
- **适配**：actview 对 `ref.value = x` 即使 x 与当前值**同一引用**也会调度重渲染。scroll-area 的测量 setter（setThumbSize/setHiddenState/setCornerSize/setOverflowEdges）先 `pickState`（浅比较）再**引用比较**，值不变时不赋值，避免测量微任务触发渲染→watch→再测量的死循环。相关文件：ScrollAreaRoot

### AD-15 getOffset 的 NaN 防御
- **适配**：jsdom 的 `getComputedStyle` 对未设置的逻辑属性（paddingBlockStart 等）返回空串，`parseFloat('') = NaN` 会污染 thumb 尺寸计算（`NaN !== NaN` 使 pickState 永远判定变化 → 死循环）；`parseFloat(x) || 0` 防御。相关文件：scroll-area/utils/getOffset.ts

### AD-16 布局测量测试的 jsdom 策略
- **适配**：jsdom 无布局（offsetHeight/clientHeight 等为 0）、无 ResizeObserver、无 `getAnimations`。scroll-area 测试：① `Object.defineProperties` mock viewport 尺寸与 scrollTop/scrollLeft；② 组件内 `typeof ResizeObserver === 'undefined'` 跳过、`viewport.getAnimations?.()` 防御；③ 依赖真实布局的断言（thumb 实际尺寸等）不在 jsdom 覆盖（react 版同场景用 `isJSDOM` 跳过）

### AD-17 useRenderElement 的 props 数组静态对象不响应
- **适配**：actview 的组件 **setup 只执行一次**；`useRenderElement` 的 `props` 数组里**普通对象字面量在 setup 期求值一次**，其中读取的响应式值（`active.value`、`hidden.value` 等）被**冻结**，后续变化不重新求值 → DOM 不更新（tabs 的 data-active/aria-selected 不出现的直接根因，见 actview-issue.md AI-001 解决链第 2 条）。**依赖响应式的 props 一律写成 getter 函数** `() => ({ ... })`（每次渲染重新求值），与 mergePropsN 的"getter 每次调用"语义匹配。已修复：TabsTab/TabsPanel/TabsIndicator。排查方法：grep `props: [` 后跟 `{` 或换行 `{` 的静态对象。

### AD-18 测试异步链需 flush/waitFor
- **适配**：挂载期多级微任务链（如 tabs 的 tabMap 注册 → watch → setValue → 重渲染）在 `render()` 后未完成，立即断言失败。对照 scroll-area 测试的 `await act(() => {})`（flush 一次渲染），tabs 测试改用 `await waitFor(...)`（自动重试到超时）断言自动选中/激活后的 DOM 状态。

### AD-19 jsdom 的原生 button 键盘激活
- **适配**：原生 `<button>` 的 Enter→click 是浏览器行为，jsdom 不合成；useButton 的键盘 click（`dispatchClickWithModifiers`）只对**非原生元素**（`nativeButton: false`）生效（见 Button.test.tsx）。键盘激活测试需手动补 `fireEvent.click` 模拟原生行为，且 `dispatchClickWithModifiers` 用 `window.PointerEvent`（jsdom 未实现），测试需 `(window as any).PointerEvent = window.MouseEvent`。

### AD-20 mergePropsN 链中 getter 的"整体替换"语义
- **适配**：`mergePropsN` 的 props 数组从左到右合并，**getter（函数）返回的对象整体替换 prev**，不自动合并。因此 props 链中若有一个无参 getter（`() => elementProps`），会**丢弃前面所有 getter 产生的属性**（如 input 的 `value`、按钮的 `aria-label`、`role` 等）→ DOM 缺属性。依赖响应式的 getter 必须写成 `(prev) => ({ ...prev, ...elementProps })`（slider 全组件已遵循）。排查方法：grep 无参的 `getElementProps()` 且其所在 props 数组还有其他 getter。已修复：number-field 全部子组件（Root/Group/Input/stepper/ScrubArea/ScrubAreaCursor）。

### AD-21 setup 期静态对象展开不响应（隐藏 input 场景）
- **适配**：actview 的 JSX return 每次渲染重新求值，但**函数体内的普通对象字面量只在 setup 求值一次**。number-field 的隐藏 `<input type="number">` 曾把 props 组装成 setup 期对象（`value: value.value ?? ''`），后续 value 变化 hidden input 不更新（stepMismatch 校验失效）。修复：**props 组装函数化** `getHiddenInputPropsWithExtras = () => ({ ... })`，在 JSX 中 `{...getHiddenInputPropsWithExtras()}` 调用，每次渲染重新求值。

### AD-22 actview 无 createPortal，用 `<Teleport to={...}>`
- **适配**：actview 无 `ReactDOM.createPortal`；提供等价内置组件 `<Teleport to={selectorOrElement}>`（从 `actview` 导入），children 渲染到目标容器（`string` → `document.querySelector`；`Element` → 直接用；null → 当前容器）。NumberFieldScrubAreaCursor 用它把虚拟光标传送到 `document.body`。条件渲染（返回 null / 三元 / `&&`）在渲染器与 Babel 插件层面原生支持。

### AD-23 测试组件需定义在顶层（Babel 转换范围）
- **适配**：测试文件里**返回 JSX 的组件若定义在 `it()` 回调内部**，actview 的 Babel 插件（@actview/plugin-vite）不识别为组件 → 运行时被当原生元素 → `DOMException`（容器渲染为空）。调试期把组件写在 `it` 内导致 number-field 全部测试"组件渲染错误"。修复：测试组件（`NumberField`、`FormDemo` 等）**定义在 describe/it 之外的文件顶层**（slider/tabs 测试均如此）。

### AD-24 actview 无 React 属性名映射（htmlFor → for）
- **适配**：actview 的 `setProp` 只有 `className → class` 一个属性名映射，其余按原 key `setAttribute` 透传。React 的 `htmlFor` 会被原样渲染为 `htmlfor` 属性（HTML 解析器强制小写），label 的 `.htmlFor`/`for` 关联失效。**必须直接写 HTML 标准属性名 `for`**。已修复：`useLabel` 返回 `for` 而非 `htmlFor`（影响所有使用 label 的组件）。

### AD-25 Field 的 messageIds 注册是替换式
- **适配**：actview 的 `LabelableContext.setMessageIds` 是**替换式写入**（`(ids: string[]) => void`），不支持 React 的函数式更新（`setMessageIds(v => v.concat(id))`）。注册/注销必须读当前列表后整体替换：`setMessageIds([...current, id])` / `setMessageIds(current.filter(i => i !== id))`。已修复：FieldError（watch immediate 注册 + onCleanup 注销）、FieldDescription 沿用。另：FieldError 的 `children` 应优先用用户传入的 children（`childrenProp ?? errorMessage`），否则用户自定义错误文案会被计算出的验证消息覆盖。

### AD-26 Form 组件 getElementProps 需合并 prev
- **适配**：form/Form.tsx 的 `getElementProps` 原为无参 getter，会整体替换 `getFormProps`（含 `onSubmit`）→ **表单提交验证失效**（jsdom 中 `fireEvent.click(submit)` / `fireEvent.submit(form)` 不触发 Field 校验）。修复为 `(prev) => ({ ...prev, ...elementProps })`（AD-20 变体，Field 测试暴露）。

### AD-27 props 链中每个 getter 都要合并 prev 才能保 id/children
- **适配**：`useRenderElement` 的 props 数组按序 merge，**每个 getter 返回的对象整体替换**累计值。若链中某 getter 返回不含 `id`/`children`/`data-*` 的新对象（如 panel 的 ARIA/style getter），会**丢弃前面 getter 提供的 id/children**（panel 渲染空 div、丢 id）。必须每个 getter 写 `(prev) => ({ ...prev, ...新属性 })`。已修复：AccordionPanel 的 aria/style getter、style 临时覆盖 getter。另外 `aria-expanded` 等 ARIA 布尔需显式 `'true'/'false'` 字符串（actview 布尔 true 渲染空串，见 PD-01）。排查方法：props 链中 grep 无 `...prev` 的 `() => ({...})` getter。

### AD-28 FloatingFocusManager 的 disabled 不响应 → 条件挂载
- **适配**：actview 组件 setup 只执行一次，`FloatingFocusManager` 的 `disabled`/`modal` props 是挂载时快照。popover 打开瞬间 `mounted` 尚未为 true，若把 `disabled={!mounted || hover}` 传入会**永久禁用焦点管理**。修复：`PopoverPopup` 用 `shouldRenderFocusManager`（`mounted && openReason !== triggerHover`）**条件渲染** FloatingFocusManager，挂载时 `disabled={false}` 固定；hover 打开时直接渲染 element 不包焦点管理器。

### AD-29 守卫条件渲染导致 trigger DOM 节点重建
- **适配**：actview 的 vnode patch 对**树结构变化**（单元素 ↔ Fragment 包裹）会重建 DOM 节点。`PopoverTrigger` 打开后在元素前后插入焦点守卫，原写法（三元切换两套结构）使 trigger 节点被重建 → `domReferenceElement` 引用失效 → useClick 把第二次点击误判为"点击非活跃 trigger"而重新打开（永远关不上）。修复：**把 element() 固定在 Fragment 的中间稳定位置**，守卫用 `{cond && renderFocusGuard(...)}` 在两侧条件渲染，element 的树位置不变、DOM 节点复用。

### AD-30 actview 组件 ref 收到组件实例而非 DOM（FocusGuard 改渲染函数）
- **适配**：actview 的 ref 解析：自定义组件 `<Comp ref={fn}>` → `fn(组件实例)`（mountComponent 处理），且 setup 的 props **删除 `ref`**（不透传）；只有内置 DOM 元素 `ref` 才收到 DOM 节点；对象 ref 写 `.value`（不写 `.current`）。因此 `FocusGuard`（组件）不能作为 ref 目标（beforeGuardRef.current 拿到的是实例对象，传给 markOthers 时 `body.contains(实例)` 抛 "parameter 1 is not of type 'Node'"）。修复：`utils/FocusGuard.tsx` 改为**渲染函数** `renderFocusGuard(props, ref)` 直接返回 `<span ref={ref}>`，调用方（FloatingFocusManager/FloatingPortal/PopoverTrigger）把 DOM ref 直接挂 span。另：actview 的组件 children 是 setup 快照——**FloatingFocusManager 渲染 children 需读 `props.children`**（父组件重渲染产生的新 vnode 才能传播），否则 popup 的 aria-labelledby 等属性更新不生效。

### AD-31 .ts 文件中的组件返回 null 不被 Babel 转换 → DOMException
- **适配**：actview 的 Babel 插件只转换**返回 JSX** 的组件（.tsx）；`utils/popups/popupStoreUtils.ts`（.ts）里的 `PopupHandleAttachment` 返回 `null`，作为 JSX 组件使用时运行时 `DOMException {}`（组件渲染错误，挂载即抛、后续子树不渲染）。修复：`PopoverRoot` 不再渲染该组件，改为在 setup 中直接 `watch(() => handle, ..., { immediate: true })` 调 `handle.attachStore(store)`（onCleanup 解绑）。

### AD-32 resolveRef 误判 DOM 元素（value 属性）为 ref
- **适配**：`resolveRef` 原实现用 `'current' in x` / `'value' in x` 判断 ref 对象；**DOM 元素（button/input/select）自带 `value` 属性** → 被误判为 ref，返回 `element.value`（字符串）→ markOthers 的 `body.contains(string)` 抛 "parameter 1 is not of type 'Node'"。修复：先判 `nodeType != null`（是 DOM 节点）直接返回原值；对象 ref 同时读 `current ?? value`（兼容 actview 的 `.value` 写入与 Base UI 的 `{ current }` 内部 ref）。

### AD-33 watch 数组源 immediate 回调首参防御
- **适配**：actview 的 `watch([refA, refB], cb)` 回调首参应为新值数组，但**个别运行路径**（effect 重入/组件卸载后触发）会传 `undefined`，`([a, b], ...)` 解构即抛 "undefined is not iterable"（异步 unhandled rejection）。共享工具（useDismiss、FloatingFocusManager 的全部数组 watch）统一改为 `(newVals, _old, onCleanup) => { const [a, b] = Array.isArray(newVals) ? newVals : []; ... }` 防御。另：`useDismiss` 的 open 监听 watch 需 `{ immediate: true }`——PopoverInteractions 可能在 open 已为 true 时才挂载（普通 watch 永不触发 → Escape/outside 关闭失效）。select 组件复用时发现 `useTransitionStatus` 的三个数组 watch 也有同样问题，已一并加防御。

### AD-34 弹层条件渲染不能 setup 期 return null（SelectPortal 场景）
- **适配**：actview 组件 setup 只执行一次，`if (!cond.value) return null` 中的 `cond.value` 是**快照**——初始为 false 时永远返回 null，之后 open/mounted 变化不会重新渲染（SelectPortal 的 `mounted || forceMount` 判断失效，弹层打不开）。修复：条件渲染放进返回的 JSX 里求值，如 `return <>{cond.value && createElement(FloatingPortal, props)}</>`（每次渲染重新求值）。同类：SelectArrow 的 `alignItemWithTriggerActive` 分支、SelectItemIndicator/SelectScrollArrow 的 `shouldRender` 分支都改用 JSX 内求值。

### AD-35 依赖响应式值的 props 必须用 getter 求值（不能 setup 期合并）
- **适配**：`useRenderElement` 的 `props` 若在 setup 期用普通对象一次合并（如 `mergeProps(storeProps.value, {...})`），`storeProps.value`/`open.value` 都是**快照**，后续变化不反映到 DOM（SelectTrigger 的 aria-expanded 永远 false、items 的 data-highlighted 不更新、triggerProps 的交互 handler 绑定不上）。修复：props 数组里用 getter 函数（每次渲染求值）——`props: [(prev: any) => mergeProps(prev, triggerProps.value), (prev: any) => ({ ...prev, ...getDefaultProps() }), elementProps, getButtonProps]`（getter 内部合并 prev 保事件链，AD-20/AD-27）。select 的 Trigger/Item/List/Popup 均按此改造。

### AD-36 渲染元素组件的 elementProps 是 setup 快照，含 children 会冻结更新（ToastRoot 场景）
- **适配**：渲染元素（非 context provider）的组件若在 setup 解构 `...elementProps` 并直接放进 props 数组，`elementProps` 是**快照**——其中 `children` 是父组件首次渲染时的 VNode，store 更新换新 toast 对象后父组件重渲染传新 children，但 elementProps.children 仍是旧 VNode 且（因在 props 数组靠后）**覆盖** getter 提供的响应式 children → 界面永不更新（toast update title 不刷新）。修复：渲染元素组件的剩余 props 用 getter 从 `componentProps` 每次重读——`const getElementProps = (prev: any) => { const { toast: _t, render: _r, className: _c, style: _s, ...rest } = componentProps; return { ...prev, ...rest }; }`（必须 `{...prev, ...rest}` 保 prev，否则丢 role 等，AD-35）。同类：ToastTitle/Description 的 `children` 必须从解构排除（`children: _children`），由 getter 用 `() => componentProps.children` 读取。

### AD-37 store 换新对象的响应式 prop 必须 computed 化（ToastRoot 的 toast）
- **适配**：`Toast.Root` 的 `toast` prop 由 store 在每次 add/update/close 时**替换为新对象**（`setToasts(toasts.map(...))`），若 setup 解构 `const { toast } = componentProps` 则冻结旧对象——transitionStatus 永远 'starting'（data-starting-style 残留）、close 的 ending 读不到（useOpenChangeComplete 永不 remove）、update 的 title 不刷新。修复：`const toast = computed(() => componentProps.toast)`，全组件读 `toast.value.xxx`（getDefaultProps/state computed/watch 源/事件回调）。这是 PD-15 在"store 换对象"场景的强制要求。

### AD-38 useRenderElement 的 getElement() 不能在 setup 缓存成 VNode（ComboboxInput 场景）
- **适配**：若把 `getElement()` 的调用结果（或含 `{getElement()}` 的 JSX 片段）赋给 setup 局部 `const renderedInput = ...`，渲染函数复用该 VNode **快照**——`useRenderElement` 的 props getter（读 store ref/computed）只在 setup 执行一次，后续响应式变化（受控 inputValue 更新、inline 补全、data 属性）**永不反映到 DOM**（autocomplete 输入后 ArrowDown 的 input.value 不更新、aria-activedescendant 缺失）。注意它与 AD-35 不同：AD-35 是 props 数组内的普通对象合并，这里是**整个渲染元素被缓存**。修复：把 JSX 三元/条件直接内联到组件**最终 return 的 JSX**（每次渲染求值 `getElement()`）——`return <>{cond ? <Provider>{getElement()}</Provider> : getElement()}</>`。排查法：给 getter 加日志，若状态已更新但 getter 不重跑，就是渲染元素被缓存。

### AD-39 context computed 值变化不驱动消费者重渲染 → 渲染用值镜像进 store（combobox inputValue）
- **适配**：`internals/createContext` 的 Provider 包 `computed(() => unref(props.value))`，消费者 `use()` 拿 live computed，但**消费者组件只在自身 store 订阅/渲染依赖变化时重渲染**——context 值变了但消费者渲染函数不重跑，读 `.value` 也拿不到新值（惰性 computed 未被读取）。combobox 的 `inputValue` 走 context（"不能放 store"是 react 语义限制），导致 autocomplete 的 inline 补全/受控 value 更新后 input 显示滞后。修复：**把渲染用字符串镜像进 store**（`store.inputValue` + AriaCombobox 同步 watch 依赖加 `inputValueValue` + ComboboxInput `store.useState('inputValue')`），消费方走已验证可靠的 store 订阅路径；语义状态（选中值等）仍不进 store。QA 记录：`.QA/combobox-context-render-reactivity.md`。

### AD-40 listRef 注册 watch 的 immediate 在 setup 跑（ref 未挂载）→ 依赖加响应式元素 ref（ComboboxItem）
- **适配**：`watch(..., { immediate: true })` 在 setup 同步执行，此时元素 ref（`{ current: null }` 普通对象）尚未挂载——若注册逻辑（如 `listRef[index] = itemRef.current`）写在 immediate 回调且依赖里**没有元素的挂载时机**，首渲染 index 已是最终值时 watch 不再重跑 → listRef 项永为 null（combobox items-prop 场景 Enter 键盘选择 clickHighlightedItem 失效；combobox 测试先打开再过滤、index 必变化所以没暴露）。修复：加响应式 `const itemElement = ref<HTMLElement|null>(null)`，ref 数组加 `(el) => { itemElement.value = el; }`，watch 依赖加 `itemElement`——挂载后立即重跑注册。

### AD-41 useListNavigation 的 aria-activedescendant 需 reference/floating 分流（typeable combobox）
- **适配**：actview 移植把 react floating-ui 的 reference/floating 两个 aria-activedescendant 分支折叠进共享 getter，且把"floating 才排除 typeable"误实现成"两侧都排除"——combobox/autocomplete 的 input 永远没有 aria-activedescendant。正确语义（react 源码 S6 证据）：reference（input）侧**无条件**（`virtual && open && activeIndex != null` 即返回 `${id}-${activeIndex}`，typeable 也不例外）；floating（list）侧才 `if (typeableComboboxReference) return undefined`。QA 记录：`.QA/floating-activedescendant-split.md`。

### AD-42 context hook 的 use() 必须在 setup 顶层调用（DirectionContext 场景）
- **适配**：`useDirection()` 若写成 `return computed(() => DirectionContext.use()...)`，`useInjects` 在 computed getter（非 setup）执行 → 警告 `useInjects 只能在组件 setup 中调用` + 返回 fallback。修复：setup 顶层先 `const context = DirectionContext.use()`，computed 里只读 `context.value`（与 useComboboxInputValueContext 同模式）。排查法：`new Error().stack` 抓 fallback 栈（computed getter 出现即命中）。

---

> 维护说明：新增差异/适配时在对应部分追加，编号递增；修改后同步更新 plan.md 与 issue.md 的关联条目。
