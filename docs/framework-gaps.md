# 框架差距审计：ActView vs React / Vue 3

> 方法：逐维度读三方**本地源码**核对（ActView `packages/core/src`、Vue3 `E:/code3/vue3/packages`、React `E:/code3/react/packages`）。
> 只列 ActView 真实缺失/不一致项；已对齐的（keyed diff LIS、事件 invoker+capture+passive、markRaw/toRaw、effectScope、Transition mode/appear 等）不列。
> 更新：2026-08。严重度：high=真实缺陷（会产生错误 DOM/输出）、medium=能力缺失、low=API 面/优化项。
> **修复状态**：P0 四项（1.1/1.2/1.3/1.6）已修复（`runtime/attr-utils.ts` 共享规范化层 + `test/platform-diff/attr-style.test.tsx`）。
> **修复状态**：P1 三项（1.4 xlink / 1.5 URL 清洗 / 1.7 决策统一）已修复——`resolveAttr` 照抄 React 分组 switch 语义双端共用（`test/platform-diff/attr-p1.test.tsx`）。
> **修复状态**：7.2 受控机制（渲染提交兜底 + toString 归一 + hydrate 不覆盖）与 P2-3 select/textarea 归一已修复（`test/platform-diff/controlled-form.test.tsx`）；radio 组互斥由浏览器原生 + 受控拉回自然覆盖。

---

## 一、属性值处理（含已知 C7/C2/C11，本批修复重点）

### 1.1 [high] style 序列化：undefined 不过滤、数字不补 px（C7+C2）
- **ActView**：`runtime/renderToString.ts:76-84` `stringifyStyle` 纯模板拼接 `Object.entries(style).map(([k,v]) => `${k}:${v}`)`——undefined/null 拼出 `k:undefined`；数字 `1/-1` 拼出 `width:1`（CSS 非法，整条声明被浏览器丢弃）。
- **React 参考**：`react-dom-bindings/src/client/CSSPropertyOperations.js:46-49、89-91`——`!isUnitlessNumber(styleName)` 时补 `px`（客户端 `setValueForStyles` 与 SSR `createDangerousStringForStyles` **同一套逻辑**，两端一致）；unitless 白名单在 `shared/isUnitlessNumber`。
- **Vue 参考**：`runtime-dom/src/modules/style.ts:104-110` 支持 `!important`（`setProperty(k,v,'important')`）与 vendor 前缀 `autoPrefix`（Webkit/Moz/ms）。
- **附加差距**：ActView 无 `!important` 支持（`color:'red !important'` 走 `el.style[k]=` 会失效）、无 vendor 前缀处理。
- 影响：SSR/golden 输出非法；C2 场景真实视觉缺陷（隐藏 input 尺寸失效）。

### 1.2 [high] 布尔属性：客户端只写 property 不写 attribute；false 分支不重置 property（C11）
- **ActView**：`runtime/renderer.ts:801-833`——`checked/disabled/readonly/required` 走 `el[key]=value`（property 有、attribute 无）；`value===false` 分支只 `removeAttribute` 不重置 property（checked true→false 再渲染时状态残留）。
- **React 参考**：`ReactDOMComponent.js` `setValueForProperty`——KNOWN_ATTRIBUTES/KNOWN_PROPERTIES 双表决策；checked 是**刻意**只设 property（attribute 属 defaultChecked 语义）。
- **Vue 参考**：`shared/src/domAttrConfig.ts:21-32` `isBooleanAttr` + `includeBooleanAttr`；`modules/props.ts:58-75` 对 boolean/enumerated 值强制转换（true→''、'false' 保留等）。
- 影响：CSS 属性选择器 `[checked]`、outerHTML/golden 快照、以及测试环境（反射不完整）下的断言差异；行为侧 checked 状态残留。

### 1.3 [medium] enumerated 属性值映射缺失（contenteditable/draggable/spellcheck）
- **ActView**：通用分支 `value===true → setAttribute(k,'')` 对**所有**键一视同仁——`contenteditable={true}` 输出 `contenteditable=""`。
- **React/Vue**：enumerated 属性 `true→'true'`、`false→'false'`（React `ReactDOMComponent.js` enumerated 处理；Vue `domAttrConfig.ts` `isBooleanAttr` 之外的 enumerated 分支）。
- 影响：`contenteditable=""` 语义仍是可编辑，但值形态与参考框架/快照不一致。

### 1.4 [medium] xlink 命名空间属性缺失
- **ActView**：无 `xlink:href` 特例，走普通 `setAttribute`。
- **React/Vue**：`setAttributeNS(xlinkNS, 'xlink:href', …)`（React `ReactDOMComponent.js:694-705`；Vue `modules/attrs.ts:26-28`）。
- 影响：SVG `<use xlink:href>` 等在某些环境属性不生效。

### 1.5 [medium] URL 属性清洗缺失（安全）
- **React**：`sanitizeURL`（`ReactDOMComponent.js:528,599,702`）对 href/src/xlink:href 过滤 `javascript:` 等危险协议（warning + 清空）。
- **ActView/Vue**：无。
- 影响：`<a href={userInput}>` 存在 XSS 面（Vue 同样无，属 React 独有强化，可低优先级）。

### 1.6 [medium] class 数组/对象合并缺失
- **ActView**：`renderer.ts:781-788` `el.className = value ?? ''`——仅字符串。
- **Vue**：`normalizeClass` 支持字符串/数组/对象条件合并（`runtime-dom/src/modules/class.ts`）。
- 影响：条件类（`class={[a && 'x', {y: ok}]}`）需手动拼接；组件库移植（Base UI 场景常见）摩擦。

### 1.7 [low] SSR/客户端属性决策分叉（C7/C2/C11 的根因形态）
- ActView 的 `setProp`（renderer.ts）与 `serializeAttrs`（renderToString.ts）**各自实现**属性/样式规则（布尔白名单只存在于 SSR 侧 `BOOLEAN_ATTRS`；px/undefined 逻辑两边都没有）。
- React/Vue 双端共用同一套规范化模块（React `setValueForStyles` 双端调用；Vue `patchStyle`/SSR `stringifyStyle` 同源）。
- 建议：抽共享 `style/attr 规范化`层，setProp 与 serializeAttrs 复用——根治「同一组件两端输出不同」这一类 bug。

---

## 二、事件系统（ActView 已较完整，余量小）

已对齐：invoker 统一解绑 + `capture/passive` 命名解析（`renderer.ts:666-686`）+ `attached` 时间戳防陈旧（`renderer.ts:663,736`，对齐 Vue `events.ts` `_vts`）。

### 2.1 [low-medium] 无事件委托
- React 合成事件委托到根容器（`react-dom-bindings/src/events`），内存/绑定开销低、动态子树无需反复绑定。
- ActView/Vue 均为逐元素 addEventListener（Vue 同 ActView，属 React 独有优化）。影响：大量节点时性能差；功能无缺失。

### 2.2 [low] 无 stopImmediatePropagation 包装
- Vue `events.ts:119-120`：invoker 内保存/恢复原始 `stopImmediatePropagation`（防 invoker 链多 handler 场景误伤）。
- ActView `renderer.ts:711-712` 直接 `invoker.value(e)`。影响：同元素多 handler + stopImmediatePropagation 边界行为。

### 2.3 [low] 无事件名归一
- React：`change` 合成（受控）、`focus/blur→focusin/focusout`（冒泡化）、touch/wheel 默认 passive。
- ActView：事件名直通 DOM（`onChange`→`change`）。影响：受控表单事件语义、焦点冒泡场景需手写兼容。

---

## 三、渲染与调度

### 3.1 [high] 时间切片/可中断渲染（已知，文档承认）
- React lanes + 可中断 Fiber 渲染 + `startTransition/useDeferredValue`（`react-reconciler/src`）。
- ActView 同步渲染管线：一次数据变更 → 微任务一次性整树刷新，无优先级、不可中断。P5/P6 已用 setTimeout 错峰降级。

### 3.2 [medium] 任务优先级分层与队列结构
- Vue `scheduler.ts`：`queueJob` + `flushPreFlushCbs`/`flushPostFlushCbs` 双层队列（组件更新与 watch 分时序）、`findInsertionIndex:78` 按 job id 排序（父先子后）、`checkRecursiveUpdates:270` 递归更新检测并告警。
- ActView `reactivity/reactive-system.ts:16` `queueJob` 简单队列 + `nextTick`；watch flush pre/post/sync 有，但无组件级双层队列与递归检测。
- 影响：复杂依赖链下的更新顺序、无限循环渲染保护缺失（React 也有类似告警）。

### 3.3 [low] 列表 diff 已对齐（无重大差距）
- ActView `renderer.ts:463-605`：keyed diff + `getSequence` LIS 最小移动（注释明确参考 Vue 3）+ 无 key 混用对齐 React。
- 仅余：重复 key 无告警（React 有 `duplicate key` warning）。

---

## 四、SSR 与水合

### 4.1 [medium] 流式 SSR 缺失
- React：`renderToPipeableStream`/`renderToReadableStream`（`react-dom/src/server/ReactDOMFizzServer*`，支持 abort、progressiveChunkSize、Suspense 流式 fallback）。
- Vue：`renderToWebStream`/`renderToPipeableStream` + async setup。
- ActView：`renderToString` 同步整串（`renderToString.ts:270`）。影响：大页面 TTFB、流式体验。

### 4.2 [medium] 选择性水合 / Suspense SSR
- React：按 Suspense 边界选择性水合；Suspense 在 SSR 流式输出 fallback 后替换。
- ActView：`hydrate.ts` 游标配对**已有**（组件复用 mountComponent 首帧 hydrate 分支、useId 两端对齐），但无选择性水合、无 Suspense 的 SSR 数据流。

### 4.3 [low] hydration mismatch 检测完整度
- Vue `hydration.ts:811-893`：逐属性/class/style/text 对比 + 类型化告警 + `data-allow-mismatch:971` 放行。
- React：`suppressHydrationWarning`。
- ActView `hydrate.ts:61`：不匹配时 console.warn + 客户端优先重建。影响：排查水合问题手段弱。

### 4.4 [low] SSR 数据预取模式
- React `use(promise)`、Vue async setup + Suspense；ActView 无渲染期 promise 读取（lazy 是模块级）。等价物需手动「SSR 前预取 → 注入 → hydrate」。

---

## 五、响应式 API 面

已有（对齐 Vue）：`ref/shallowRef/isRef/unref/toValue/toRef/toRefs/rawRef/unrefs`、`reactive/shallowReactive/shallowReadonly/readonly/markRaw:56/toRaw:62`、`computed`、`watch/watchEffect/onWatcherCleanup`、`effectScope/onScopeDispose`（`export * from './effectScope'`）、`triggerRef`、类型守卫（isReactive 等，test/reactivity/type-guards）。

### 5.1 [low] 缺失 API
- `customRef`（Vue `reactivity/src/ref.ts`）——自定义 get/set 的 ref，防抖等场景。
- `proxyRefs` 等价物——ActView get trap **不解包 ref**（设计使然）；`unrefs` 只解包对象一次，无代理形态。
- `toReactive`/`toReadonly`（Vue `reactivity/src/reactive.ts`）。
- `deferredComputed`（Vue `computed` 导出）。
- 未验证：Map/Set/WeakMap 集合响应式支持、数组索引/长度赋值追踪——建议补基准测试确认。

---

## 六、组件系统

### 6.1 [medium] expose() 等价缺失
- Vue `defineExpose/expose()` 声明式限制公共 API；ActView 契约为「父传入 ref 对象，子写入口」（设计差异），无法声明式约束暴露面，也没有组件 ref 到实例后读取公共 API 的通道。
- 影响：跨组件命令式 API 生态（如 focus 库）需要自建约定。

### 6.2 [medium] attrs 透传缺失
- Vue `inheritAttrs`/`$attrs`；React 自动透传 props。ActView **无透传**（scopedId 等需子组件手动声明应用——已在 plantform-diff 文档化的设计选择）。
- 影响：包装组件（Base UI 模式）需逐项转发 props。

### 6.3 [low] Transition 完整度
- 已有：`mode="out-in"`/`appear`/`duration`/enter-leave 类名/transitionend+兜底（`runtime/transition.ts`）。
- 缺失：JS 钩子（beforeEnter/enter/afterEnter…）、`TransitionGroup`（列表 move 动画）、leave 期间新元素样式协商（Vue `BaseTransition.ts`/`TransitionGroup.ts`）。

### 6.4 [low] React 19 动作相关
- `use()/Actions/useOptimistic/useActionState/useFormStatus` 无等价——已在前端迁移文档（PatternsPage P5-P8）用原生原语组合降级，此处仅为记录。

---

## 七、表单与受控组件

### 7.1 [medium] select/textarea/radio 归一缺失
- React：`ReactDOMSelect.js`（select value→selected）、`ReactDOMTextarea.js`（children→value）、`ReactDOMOption.js`、radio 组互斥（`ReactDOMInput.js`）。
- ActView：仅 `input[type=text]` 类有 `setInputValue` 光标恢复（`renderer.ts:861-880`）；`<select value>`、`<textarea>` children 语义、radio 组互斥均无特例。
- Vue：v-model 编译期展开 + `directives/vModel.ts` checkbox/radio/select 特例。
- 影响：受控 select/textarea 在 ActView 下需手写 `selected`/`value` 属性，行为与 React 受控语义有偏差。

### 7.2 受控输入机制对比（React vs ActView，2026-08 记录）

**现状对比**（React `ReactDOMInput.js`+`inputValueTracking.js` vs ActView `renderer.ts:716-764,815-833`）：

| 维度 | React | ActView |
|---|---|---|
| 受控判定 | value/checked 非 null | 同（`__avControlled` 标记） |
| 追踪 | valueTracker 劫持 value/checked setter，记忆「框架最后一次写入值」 | 不劫持，直接比较 `el.value !== 渲染值` |
| 还原触发 | **每次渲染提交**（updateInput commit 时比较+写回）+ focus 时 restoreStateIfNeeded——不依赖事件 | 仅 input/change 事件后 nextTick 拉回（渲染提交后执行，但触发面是事件） |
| 值比较 | `toString(getToStringValue(v))` 归一 | 原始值 `!==`（5 vs "5" 恒不等 → 多余 DOM 写） |
| 光标 | 不专门管 | setInputValue 恢复 selection（更精细） |
| radio 组 | name 断开重连原子应用 + 同组同步 | 无 |
| submit/reset | 不设 value attribute（#12872） | 无特例 |
| type=number | 0 vs '' 特殊比较、聚焦不写 defaultValue（#7253） | 无 |
| hydration | trackHydrated 不覆盖用户输入 + queueChangeEvent 重放 | 待核对 |

**结论/借鉴方向**（已记录，待排期）：
1. 还原从「事件驱动」升为「渲染提交兜底」——每次渲染 flush 后统一检查受控元素，覆盖自动填充/脚本改 DOM 等非事件场景（ActView 注释「对齐 React commit 阶段」只对齐了时机、没对齐触发面）
2. toString 归一后再比较（避免 number/boolean 造成的多余 DOM 写与光标重置）
3. valueTracker 劫持 setter **不建议照抄**（直接比较渲染值语义等价、无 defineProperty 兼容坑）
4. submit/reset value attribute 特例（#12872）、type=number 特例、hydration 不覆盖用户输入

### 7.2 [low] 无指令系统（架构差异，非缺陷）
- Vue 有模板编译器 + `directives/vModel|vOn|vShow`；ActView 走 JSX，`v-model`/`v-show` 等价物需手动组合（value+oninput / style.display）——迁移文档已覆盖。v-show 高频切换无内置等价（display 切换需 watch 手动）。

---

## 八、性能原语

### 8.1 [low] 组件级 memo / 编译期优化缺失
- React `memo/useMemo/useCallback`；Vue 模板编译期静态提升/v-once/v-memo。
- ActView：细粒度响应式（只重渲染读取了变化数据的组件/节点）部分补偿，但无组件级「跳过重渲染」显式原语、无编译期静态优化（JSX 天然无 v-memo 等价物）。
- 影响：大列表 + 高频更新场景需手动优化（computed/局部化状态）。

---

## 修复优先级建议

| 优先级 | 项目 | 理由 |
|---|---|---|
| **P0** | C7+C2 stringifyStyle（undefined 过滤 + px + unitless 白名单）、C11 布尔分支（attribute+property+false 重置）、enumerated 值映射、class 数组/对象 | 真实缺陷，改动集中、量小，直接消除 golden 差异 |
| **P1** | 抽共享 style/attr 规范化层（setProp 与 serializeAttrs 复用）、xlink、URL 清洗 | 根治「SSR/客户端两端分裂」这一类问题（C7/C2/C11 的根因形态），顺带安全强化 |
| **P2** | 流式 SSR、TransitionGroup/JS 钩子、select/textarea/radio 归一、调度双层队列+递归检测 | 能力补齐，工作量中等 |
| **P3** | customRef/proxyRefs/toReactive/deferredComputed、事件委托、重复 key 告警、hydration mismatch 逐属性检测 | API 面与优化项，按需 |

## 附：本次核对依据（关键行号）

- ActView：`renderToString.ts:76-84,259-262`、`renderer.ts:763-854,861-880,463-605,666-736`、`reactivity/reactive.ts:56-62`、`runtime/transition.ts`
- Vue：`runtime-dom/src/modules/style.ts:104-110`、`modules/attrs.ts:26-28`、`modules/props.ts:58-75`、`modules/events.ts:99-151`、`shared/src/domAttrConfig.ts:21-32`、`runtime-core/src/scheduler.ts:78-270`、`runtime-core/src/hydration.ts:811-971`、`reactivity/src/index.ts`
- React：`react-dom-bindings/src/client/CSSPropertyOperations.js:46-49,89-91`、`ReactDOMComponent.js:511-842`（KNOWN_* 决策、sanitizeURL、xlink、checked 特例）、`react-dom/src/server/ReactDOMFizzServerNode.js:131,207`（renderToPipeableStream/ReadableStream）
