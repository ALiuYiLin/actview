# 渲染器设计：`createApp(App).mount('#app')` 与组件级 re-render

> 本文档定义 `@actview/core`（DOM 渲染器）的架构：应用创建、组件挂载、渲染、diff patch、以及基于响应式的**组件级 re-render** 模型。
> 前置契约见 [types-architecture.md](./types-architecture.md)（`Component` = 带标记的 setup 函数）与 [compiler-layers.md](./compiler-layers.md)（组件包装 / JSX 降级）。

---

## 1. 目标与约束

```
createApp(App).mount('#app')
  → 组件 setup 执行一次
  → render 函数执行，生成 VNode 树
  → patch 到 DOM
  → 响应式数据变化：只重跑"变化所属组件"的 render → 子树 diff patch
```

- **组件级 re-render**：不做 React 式整树重渲染，也不做 Signal 式细粒度 DOM 更新；更新粒度 = 组件。
- **setup 只执行一次**（组件契约），render 执行 N 次。
- 组件边界 = setup 函数本体（`isComponent(vnode.type)` 判定），没有 `{ __setup }` 包装。
- 首帧同步挂载；后续更新走微任务批处理。
- 平台无关：patch 逻辑通过 `createRenderer(options)` 与 DOM 解耦（M1 只实现 DOM，接口预留 SSR/自定义平台）。

---

## 2. 现有积木（复用，不重造）

| 积木 | 位置 | 用途 |
|---|---|---|
| `VNode` / `createVNode` / `Fragment` | `packages/runtime-core/src/vnode.ts` | 渲染器消费的树节点；`el` / `component` 槽位由渲染器写 |
| `Component` = marked setup 函数、`isComponent` | `packages/runtime-core/src/component.ts` | 挂载 = 调用函数拿 render；组件判定不靠返回值形状 |
| `RenderFunction = () => Element \| null` | 同上 | 组件更新的边界 |
| `createElement` / jsx runtime | `packages/runtime-core/src/factory.ts`、`packages/jsx/src/jsx-runtime.ts` | VNode 来源 |
| `ReactiveEffect(fn, { scheduler })`、`effect`、`pauseTracking`、`EffectScope`、`shallowReactive` | `packages/reactivity/src/{effect,effectScope,reactive}.ts` | 渲染 effect、依赖收集、调度、卸载清理 |

M1 需要补充：文本 VNode（`Text` symbol）、渲染器实例类型、scheduler、生命周期、props 初始化/更新、事件/属性 patch、ref。

---

## 3. 模块划分

```
packages/runtime-core/src/
  element.ts / vnode.ts / component.ts / factory.ts     # 跨平台类型 + 最小工厂（已有，M1 增加 Text 符号）
packages/core/src/
  app.ts          createApp / AppContext / mount / unmount
  renderer.ts     createRenderer(options) + patch 主流程（树 + 组件挂载/更新/卸载）
  component.ts    createComponentInstance / setupComponent / renderComponentRoot / props
  instance.ts     ComponentInternalInstance（渲染器实例类型）、AppContext、SchedulerJob
  scheduler.ts    queueJob / queuePostFlushCb / flushJobs / nextTick
  lifecycle.ts    currentInstance 栈、onBeforeMount / onMounted / ... 钩子注册
  domProps.ts     patchProp / patchProps（class/style/事件/属性）
  refs.ts         setRef（元素 ref / 组件 ref）
  index.ts        公开入口
```

依赖方向：`core → runtime-core`（类型/工厂）、`core → reactivity`（effect/scope）；`runtime-core` 不依赖 core。

---

## 4. 应用创建与挂载时序

```ts
const app = createApp(App, rootProps?)
app.mount('#app')

// 内部：
container = resolveContainer('#app')          // string → document.querySelector
vnode = createVNode(App, rootProps ?? null, null)
vnode.appContext = app._context
render(vnode, container)                      // patch(null, vnode, container, null, null)
container.__actview_app__ = app
return vnode.component                        // 内部实例（public proxy 后续补）
```

- `render(vnode, container)`：`patch(container._vnode, vnode, container)`，成功后 `container._vnode = vnode`；`render(null, container)` 即卸载。
- 重复 mount 同一容器 → dev warning。
- `app.unmount()`：`render(null, container)` + 清理 `app._container`。
- 对外 API：`mount / unmount / config / component`；插件（`use`）、provide 后续补。

---

## 5. 组件实例

```ts
interface ComponentInternalInstance {
  uid: number
  type: ComponentTag                    // marked setup 函数
  parent: ComponentInternalInstance | null
  appContext: AppContext
  props: Record<string, any>            // shallowReactive（父写 props 触发子 effect）
  render: RenderFunction
  subTree: VNode | null                 // 当前子树（diff 的唯一旧树）
  effect: ReactiveEffect                // 组件级 render effect
  job: SchedulerJob                     // 更新任务（id = uid，用于排序/去重）
  scope: EffectScope                    // setup 期间的 watch/computed/render effect 统一停止
  isMounted: boolean
  container: Element | null
  injects: Record<PropertyKey, any>     // provide/inject（M2）
  update: () => void
  beforeMount / mounted / beforeUpdate / updated / beforeUnmount / unmounted: Hook[]
  // 后续：errorCaptured / activated / deactivated / serverPrefetch ...
}
```

说明：

- 实例类型放 `core/src/instance.ts`（渲染器实现细节）；`runtime-core/internal` 的极简 `ComponentInternalInstance` 作为跨包基础契约保留，core 类型在其上扩展。
- `props` 是 **shallowReactive**：父组件更新时原地写 props → 触发子组件 render effect；不改写为新对象，避免依赖失效。

---

## 6. 组件挂载（mountComponent）

```
① createComponentInstance(vnode, parent, appContext)
② setupComponent(instance)        # setup 执行一次
③ setupRenderEffect(instance)     # render effect + 首帧同步渲染
```

### 6.1 setupComponent

```ts
function setupComponent(instance) {
  initProps(instance, instance.vnode.props)      // shallowReactive，去掉 key
  const prev = setCurrentInstance(instance)      // 栈式实例上下文
  try {
    instance.scope.run(() => {
      pauseTracking()                            // 关键：setup 读取不能进父 render effect
      try {
        const result = instance.type(instance.props, { get injects() { return instance.injects } })
        instance.render = result                 // 组件契约：返回 RenderFunction
      } finally { resetTracking() }
    })
  } finally { setCurrentInstance(prev) }
}
```

**为什么必须 `pauseTracking`**：首帧挂载发生在父组件 render effect 的执行栈里（`activeSub` = 父 effect）。setup 若读取响应式数据会被父 effect 收集，导致后续父组件重渲染 → 自激循环。setup 的读取不建立渲染依赖；**只有 render 执行期间的读取才收集依赖**。

### 6.2 setupRenderEffect

```ts
const componentUpdateFn = () => {
  if (!instance.isMounted) {
    invokeHooks(instance.beforeMount)
    const subTree = renderComponentRoot(instance)
    patch(null, subTree, container, anchor, instance)
    vnode.el = instance.subTree.el
    instance.isMounted = true
    queuePostFlushCb(() => invokeHooks(instance.mounted))
  } else {
    invokeHooks(instance.beforeUpdate)
    const prevTree = instance.subTree
    const nextTree = renderComponentRoot(instance)
    instance.subTree = nextTree
    patch(prevTree, nextTree, instance.container!, getNextHostNode(prevTree), instance)
    vnode.el = nextTree.el
    queuePostFlushCb(() => invokeHooks(instance.updated))
  }
}

const effect = new ReactiveEffect(componentUpdateFn, () => queueJob(instance.job))
instance.scope.run(() => {
  instance.effect = effect
  effect.run()                 // 首帧同步执行
})
instance.update = () => queueJob(instance.job)
```

要点：

- 首帧同步（mount 返回时 DOM 已就绪）；更新由 scheduler 批处理。
- `instance.subTree` 是 diff 的旧树；`vnode.el` 始终指向子树根 DOM。
- 组件卸载：`scope.stop()`（停 render effect + setup 内 watch/computed）、`job.active = false`、子树 unmount、ref 置 null。

### 6.3 renderComponentRoot（返回值归一化）

```
null / undefined / boolean   → null
string / number             → 文本 VNode（Text symbol）
array                       → Fragment VNode（children 数组）
VNode                       → 原样
function / 其他对象          → 报错（组件渲染值非法）
```

这样"组件 return 什么"由编译器包 thunk、运行时归一化兜底，两边契约闭合。

### 6.4 父组件更新到子组件

```ts
function updateComponent(n1, n2) {
  const instance = (n2.component = n1.component)
  instance.vnode = n2
  updateProps(instance, n2.props ?? {}, n1.props ?? {})   // 原地写 shallowReactive
  if (shouldUpdateComponent(n1, n2)) queueJob(instance.job)   // job 去重，同 tick 一次
}
```

`updateProps` 写入触发子 effect 的 scheduler；显式 `queueJob` 与依赖触发的 queueJob 由 `job` 去重合并。`shouldUpdateComponent` 先做 props 浅比较（M1 可以是"有变化就更新"），后续再加 slots/forceUpdate 优化。

---

## 7. 渲染与 patch

### 7.1 分派

```ts
function patch(n1, n2, container, anchor, parent) {
  if (n1 === n2) return
  if (n1 && !isSameVNodeType(n1, n2)) {   // type 或 key 不同 → 卸载旧的、挂新的
    unmount(n1, parent)
    n1 = null
  }
  const { type } = n2
  if (type === Text)                          patchText(n1, n2)
  else if (type === Fragment)                 processFragment(n1, n2, container, anchor, parent)
  else if (typeof type === 'string')          processElement(n1, n2, container, anchor, parent)
  else if (isComponent(type))                 n1 ? updateComponent(n1, n2) : mountComponent(n2, container, anchor, parent)
  else throw new Error('[actview] 无效 VNode type')
}
```

- 组件判定直接用 `isComponent(type)`（标记），与编译器/运行时契约一致；
- `mountElement`：`createElement(tag)` → 挂 children → `patchProp` → ref → `insertBefore` → `vnode.el`；
- `patchElement`：`patchProps(prevProps, nextProps)` + `patchChildren`；
- `processFragment` / 数组：没有宿主节点，`el` 指向首节点；更新锚点用 `getNextHostNode(prevTree)`；
- `unmount`：递归子节点 → 组件 `beforeUnmount` → `scope.stop()` → 移除 DOM → `unmounted`（post）。

### 7.2 children diff 分阶段

| 阶段 | 策略 | 说明 |
|---|---|---|
| **M1** | 位置对齐时逐位 patch，否则卸载全部 + 重新挂载 | 最小正确实现；text/单子节点更新稳定 |
| **M2** | unkeyed 双端（公共前缀/后缀逐个 patch，多余 mount/unmount） | 无 key 列表 |
| **M3** | keyed 双端 diff（头头/尾尾/头尾/尾头 + map 复用）；可选 LIS 最小移动 | keyed 列表稳定、DOM 移动最少 |

### 7.3 props / 事件 / ref

- `patchProp(el, key, prev, next)`：
  - `ref` 交给 `setRef`；
  - `class` / `style` 归一化；
  - `onXxx` → `removeEventListener(prev)` + `addEventListener(next)`（render 每次产生新闭包，必须换监听）；
  - 其它：`setAttribute`；`value/checked/disabled` 等 DOM property 特例后续补。
- `ref`：元素 ref → DOM；组件 ref → 实例；卸载置 null；在挂载/卸载路径处理。

---

## 8. 调度器（组件级批处理）

```ts
queueJob(job)                 // 按 id（组件 uid）排序插入；同 job 去重
queuePostFlushCb(cb)          // mounted / updated / refs 等，整轮 patch 完成后执行
nextTick(fn?)                 // 当前 flush 完成后执行
```

- 微任务批处理：同一个 tick 内多个响应式变化 → 组件只重跑一次 render；
- 排序：组件 uid 小的先执行（父先子后），避免子先渲染再被父覆盖；
- post 队列：mounted/updated 在 DOM 就绪后执行，**按入队顺序**（子组件挂载先入队 → 子 mounted 先于父 mounted）；
- 卸载/停用：`job.active = false`，flush 时跳过；
- 自触发保护：render 内改状态会再次入队，由 job 去重 + `allowRecurse` 控制。

---

## 9. 依赖收集边界（易错点）

| 时机 | 处理 | 原因 |
|---|---|---|
| setup 执行 | `pauseTracking()` | setup 在父 effect 栈中执行，读取不能污染父 effect |
| 生命周期钩子 | `pauseTracking()`（`invokeHooks` 统一处理） | 钩子内写状态不应反向收集依赖 |
| render 执行 | 正常 tracking | 组件依赖唯一来源 |
| 事件回调 / 组件外部 | 正常 | 触发依赖 → scheduler → 重渲染 |
| patch / DOM 操作 | 不读取响应式数据 | 避免意外依赖 |

---

## 10. 生命周期 / provide-inject / 错误处理

- `currentInstance` 用栈保存（嵌套 mount 时恢复父上下文）；
- hooks 数组挂在实例上；API：`onBeforeMount / onMounted / onBeforeUpdate / onUpdated / onBeforeUnmount / onUnmounted`；
- 执行顺序：`beforeMount`(父) → 子树挂载 → `mounted`(子→父，post)；更新 `beforeUpdate` → render/patch → `updated`（post）；
- provide/inject（M2）：`instance.injects` 继承父引用，首次 provide copy-on-write；`ctx.injects` 用 getter 指向最新表；
- 错误处理（M2/M3）：setup/render/patch 统一 try/catch → `errorCaptured` 沿 parent 链 → `app.config.errorHandler`；首帧 mount 错误 dev 下抛出。

---

## 11. async setup / Suspense（M3 预留）

`setup` 返回 Promise 时：`instance.render = () => null` → 注册到最近 Suspense → resolve 后 `instance.render = render; queueJob(instance.job)`。
M1 只实现同步 setup；`setupComponent` 里留好分支位置。

---

## 12. 决策记录

| 决策 | 选择 | 理由 |
|---|---|---|
| 更新粒度 | **组件级** | setup-once 模型的自然结果；全树重渲染会让 setup/props 语义复杂化 |
| 首帧时机 | **同步** | mount 返回后 DOM 就绪，测试/SSR/首屏友好 |
| 更新调度 | **微任务批处理** | 同 tick 多次变化合并为一次 render |
| children diff | M1 位置 patch/替换 → M2 unkeyed → M3 keyed | 每阶段都有可测试的正确性基线 |
| 未标记函数当组件 | **dev 报错** | 避免两套语义；编译器保证组件是 marked setup 函数 |
| 实例类型位置 | `core/src/instance.ts`（runtime-core 保留跨包基础契约） | 渲染器实现细节不进跨平台类型层 |
| mount 返回值 | M1 返回内部实例；public proxy 后续补 | 先满足测试/调试，proxy 是增量 |

---

## 13. 分阶段计划

### M1（最小闭环，本次目标 — ✅ 已实现）

- `createApp` / `mount` / `unmount`；
- text / element / Fragment / 组件 patch；首帧 + 更新 + 卸载；
- props 初始化/更新（shallowReactive 原地写，父子联动）；
- children：位置对齐逐位 patch，否则全量替换；
- `patchProp` 基础：属性、class、style、`onXxx` 事件；
- 生命周期：`onBeforeMount / onMounted / onBeforeUnmount / onUnmounted`；
- scheduler：`queueJob / queuePostFlushCb / nextTick`，微任务批处理；
- refs：元素 ref 基础支持；
- 测试（happy-dom）：挂载 DOM、响应式更新、批处理、props 更新、条件切换卸载/挂载、卸载停止更新、生命周期顺序、Fragment/文本归一化。

**M1 落地信息**

- 代码：`packages/core/src/{app,renderer,component,instance,scheduler,lifecycle,domProps,refs,index}.ts`；`packages/runtime-core/src/vnode.ts` 新增 `Text` / `createTextVNode`。
- 测试：`packages/core/__tests__/renderer.spec.ts`（15 用例；`pnpm test` 全仓 411 passed / 4 skipped）。
- 实现备注：
  - 本版 `ReactiveEffect` 构造函数只接收 `fn`，render effect 用 `effect.scheduler = () => queueJob(job)`，且必须在 `instance.scope.run()` 内创建（构造时按 activeEffectScope 登记，否则 `scope.stop()` 停不掉 render effect）。
  - `getNextHostNode` 对组件递归子树，组件根为 Fragment 时锚点仍正确。
  - 组件 render 返回 `null` ↔ 内容的切换：M1 无占位节点，从 null 变为内容时只能追加挂载（无法记录原位置锚点）；这是 M1 的已知限制。
  - `unmounted` 是 post hook：组件切换后同步断言会看到 post 语义顺序（`await nextTick()` 后为常规顺序）。
  - `packages/core/tsconfig.json` 因直接消费 reactivity/shared 源码，对齐了 ES2016 + 关闭 `erasableSyntaxOnly`（project references 债，见 `docs/types-architecture.md` §7）。

### M2（更新与能力补全 — ✅ 已实现）

- unkeyed / keyed children diff；
- `beforeUpdate / updated`、`shouldUpdateComponent` 优化；
- provide / inject、组件实例 public proxy、`nextTick` 完整语义；
- `patchProp` 完整（DOM property、SVG、事件修饰）。

**M2 落地信息**

- keyed diff（`renderer.ts`）：Vue 3 风格双端同步 + key→旧索引 map；中间段复用节点通过 `collectHostNodes` / `moveHostNodes` 归位（组件根为 Fragment / 渲染 null 的节点跳过）；混合列表（部分无 key）按旧无 key 节点顺序回退复用；**LIS 最小移动留到 M3**（当前移动已就位节点会跳过 DOM 操作）。
- unkeyed diff：公共段逐位 patch，其余尾部卸载 / 按锚点挂载。
- provide / inject（`apiProvide.ts`）：`provide` 在继承引用上 copy-on-write，兄弟隔离；`inject` own-property 查找，支持默认值与显式 `undefined` 区分；**仅 setup 内可用**（render 期调用会 throw，保持与 Vue 一致；见决策记录）。`app.provide()` 写入 AppContext.provides。
- public instance proxy（`component.ts`）：`$`、`$props`、`$el`、`$parent`、`$root`、`$forceUpdate`、`$nextTick`；`app.mount()` 与组件 ref 都返回/指向 proxy。
- `shouldUpdateComponent` 保持 props 浅比较；`$forceUpdate` 直接 `queueJob(instance.job)` 绕过比较。
- `patchProp`（`domProps.ts`）：DOM property 判定（value/checked/disabled/muted/selected 等；SVG 属性一律走 attribute 避免只读 SVGAnimated*）、class（string/array/object）、style（string/对象/custom property/移除旧 key）、事件（Capture/Once/Passive 后缀 + `{handler, options}` 对象形态 + 解绑）、`innerHTML` / `textContent`、布尔属性与属性移除。
- 测试：`packages/core/__tests__/m2.spec.ts`（23 用例；全仓 434 passed / 4 skipped）。
- 已知限制：inject 仅 setup 内可用；keyed 无 LIS；事件选项经属性名/对象声明，无模板修饰符语法。

### M3（错误边界 / 异步 / 内置组件 / DevTools / LIS — ✅ 已实现）

- 错误边界（ErrorBoundary / errorCaptured）；
- Suspense / async setup / lazy；
- Teleport / Transition / KeepAlive（内置组件）；
- DevTools 钩子、keyed LIS 优化。

**M3 落地信息**

- 错误处理（`errorHandling.ts` / `errorBoundary.ts` / `lifecycle.ts`）：`handleError(err, instance, info)` 沿 parent 链跑 `errorCaptured`（返回 false = 已捕获）→ `app.config.errorHandler` → console.error + 上抛；`onErrorCaptured`；`ErrorBoundary`（fallback 支持 VNode 或函数）；setup / render+patch / unmount 全路径接入。
- 关键语义修复：本版 reactivity 对 RUNNING effect 忽略 notify，父组件首帧 patch 期间子组件挂载引发的 `Suspense.register()` / ErrorBoundary 错误钩子写状态会被吞。renderer 用 `patchWithRecurse` 只在 patch 子树期间临时开 `EffectFlags.ALLOW_RECURSE`（不包 render，保持 render 自触发忽略）。
- async setup（`component.ts` + `renderer.ts`）：`setup()` 返回 Promise 时先渲染 `() => null` 占位，向最近 Suspense `register()`；resolve 后写回 `instance.render`、`resolve()` 并 `queueJob`；reject 交给 `handleError`。
- Suspense / lazy（`suspense.ts`）：模块级 suspense 栈；children 常驻 div（pending 时 `display:none`）+ fallback；`lazy(loader)` 缓存 loader，async setup 后渲染真实组件。
- 内置组件：`Teleport`（renderer 特判 `__builtin:'teleport'`，children patch 到 `resolveTeleportTarget(props.to)` 目标容器，支持 to 变化/卸载）、`Transition`（单子节点 enter/leave 类名 + 延迟卸载，`name` 默认 `v`、`duration` 默认 300ms）、`KeepAlive`（缓存组件实例/DOM，activated/deactivated、include/exclude、max LRU；unmount 时 renderer 把 host 节点移入 storage 并写 cache，重新命中走激活路径）。`lifecycle` 增加 `onActivated` / `onDeactivated`。
- DevTools（`devtools.ts`）：`setDevtoolsHook` / `getDevtoolsHook`，renderer 在 mount/update/unmount 上报 `{ id, name, instance, parent }`；未注册时零开销。
- keyed LIS（`renderer.ts`）：`getSequence()`（贪心+二分+前驱回溯）最小化 DOM 移动；同 key 换 type / 新建节点记 0 强制移动。
- 测试：`packages/core/__tests__/m3.spec.ts`（9）+ `m3b.spec.ts`（6）；全仓 449 passed / 4 skipped。
- M3 设计内限制：同一 target 的多个 Teleport 仅按 append 顺序（无跨树锚点）；Transition 位于被整体移除的子树内时 leave 会被打断；KeepAlive 仅支持单根组件子树；Suspense 用 div 包裹 children（会多一层 DOM）。

### M4

- SSR / hydrate；
- 平台抽象（`createRenderer` 复用非 DOM 平台）；
- 编译期优化（静态提升等）的渲染器配合。

---

## 14. 验收标准（M1）

1. `createApp(App).mount(container)` 后 DOM 与组件 render 输出一致；
2. 响应式数据变化 → `await nextTick()` 后 DOM 更新，且**只有所属组件**的 render 重跑（spy 计数）；
3. 同一 tick 多次变化只触发一次 render；
4. 父组件状态变化 → 子组件 props 更新（setup 不重跑，render 重跑一次）；
5. 条件渲染切换组件类型 → 旧组件 unmount（`scope.stop()`）+ 新组件 mount；
6. `app.unmount()` 移除 DOM，之后状态变化不再触发 render；
7. 生命周期顺序：`beforeMount`（父）→ 子树 → `mounted`（子先父后）；卸载对应顺序；
8. 文本 / 数字 / `null` / 数组 / Fragment 渲染归一化正确。
