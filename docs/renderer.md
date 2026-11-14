# 渲染器设计

> 实现层：`@actview/core`。组件模型与装饰器见 [decorators.md](./decorators.md)，包结构见 [architecture.md](./architecture.md)。

## 1. 目标

- 组件级 re-render：状态变化只重跑所属组件的 `render()`，不做整树重渲染，也不做细粒度 DOM 更新；
- `@Setup` 只执行一次，`render()` 执行 N 次；
- 首帧同步挂载，后续更新走微任务批处理；
- DOM 操作集中在 `runtime/`，平台抽象（SSR/非 DOM）后续再做。

## 2. 运行时模块

```text
runtime/app.ts               createApp / mount / unmount
runtime/mountComponent.ts    mountClassComponent（构造 → 安装 → @Setup → render）
runtime/installReactiveApi.ts  @Prop/@Ref/@Reactive/@Computed/@Inject/@Provide/@Watch
runtime/installLifecycle.ts  生命周期装饰器 → hooks
runtime/component.ts         实例创建 / props / renderComponentRoot / shouldUpdate
runtime/instance.ts          ComponentInternalInstance / ComponentPublicInstance
runtime/scheduler.ts         微任务队列 / queueJob / nextTick / post flush
runtime/patch/index.ts       render / patch 分派 / children diff / component+element
runtime/patch/patchProps.ts  DOM property / class / style / 事件
runtime/vnode.ts             VNode / createVNode / Text / Fragment
runtime/hostNodes.ts         宿主节点收集 / 移动
runtime/refs.ts              元素 / 组件 ref
runtime/apiProvide.ts        provide / inject（setup 期）
runtime/errorHandling.ts     handleError / errorCaptured
runtime/devtools.ts          DevTools hook
```

## 3. 应用创建与挂载

```text
createApp(RootClass)
  → mount(container)
    → createVNode(RootClass, props)
    → render(vnode, container)
      → patch(null, vnode, container, null, null)
        → mountComponent
```

- `app.mount()` 返回根组件的公开实例；
- `app.unmount()` 等价 `render(null, container)`，停掉 scope / 更新任务并移除 DOM。

## 4. 组件实例

`ComponentInternalInstance`（`runtime/instance.ts`）包含：

- `uid` / `type`（`@Component` 类） / `parent` / `appContext` / `vnode`；
- `props`（shallowReactive，原地更新）；
- `render`（`() => ctx.render()` 包装） / `subTree`；
- `effect` / `job` / `scope` / `container` / `isMounted`；
- `injects`（provide/inject 继承表）、`proxy`（公开实例）；
- 生命周期 hooks 数组（beforeMount / mounted / beforeUpdate / updated / beforeUnmount / unmounted / activated / deactivated / errorCaptured）；
- `ctx`（类实例）。

## 5. 类组件挂载

`mountClassComponent(instance)`：

```text
new Ctor(props)
→ installClassPublicInstance（$ / $props / $el / $parent / $root / $forceUpdate / $nextTick）
→ setCurrentInstance + instance.scope.run：
    installDeclaredFields（@Prop / @Ref / @Reactive / @Inject）
    installComputed
    installLifecycle（注册 hooks）
    @Setup（可返回 Promise）
    @Provide / @Watch
→ instance.render = () => ctx.render()
→ setupRenderEffect
```

- `@Ref` / `@Prop` 的 accessor 必须在构造后安装：ES2022 class field 的 define 语义会创建 own data property 并遮蔽原型 accessor；
- 同步 `@Setup` 完成后立即渲染；async `@Setup` 先渲染 null，resolve 后安装 provide/watch 并触发更新。

## 6. 组件 render effect 与调度

- `setupRenderEffect` 创建 `ReactiveEffect(componentUpdateFn, { scheduler: () => queueJob(instance.job) })`；
- 首帧同步执行 `renderComponentRoot` → `patch`；
- 更新由 `queueJob` 微任务批处理，同一 tick 多次状态变化合并；
- `instance.job.id = uid` 保证父先子后；`queuePostFlushCb` 跑 mounted/updated/unmounted 等 post hooks；
- `nextTick()` 等待当前 flush。

`renderComponentRoot` 归一化：`null/undefined/boolean` → null；`string/number` → Text VNode；数组 → Fragment；VNode 原样；其它报错。

## 7. patch

### 7.1 分派

`patch(n1, n2, container, anchor, parent)` 按类型：

- `Text` → `patchText`；
- `string` type → `processElement`（mount / patch / unmount）；
- `Fragment` → `processFragment`；
- `type.__builtin === 'teleport' | 'transition'` → Teleport / Transition；
- `isComponent(type)`（`__actview_class_component`）→ `mountComponent` / `updateComponent` / `unmountComponent`；
- 其它非法 type 报错。

`isSameVNodeType`：`type` + `key` 相同；type 不同直接卸载旧节点 + 挂载新节点。

### 7.2 children 更新

- unkeyed：公共段逐位 patch，尾部卸载 / 挂载；
- keyed：双端同步 + key→旧索引 map；中间段复用节点，LIS 计算稳定集合，最小化 DOM 移动；
- 组件根可能是 Fragment / 多宿主节点，移动与锚点使用 `collectHostNodes` / `moveHostNodes`；
- `getNextHostNode` 处理 Fragment / Teleport / 组件子树。

### 7.3 DOM props

`patchProps` 支持：

- DOM property 判定（value / checked / disabled / muted / selected 等；SVG 属性走 attribute）；
- `class`（string / 数组 / 对象）；
- `style`（string / 对象 / custom property / 清理旧 key）；
- 事件 `onXxx`（Capture/Once/Passive 后缀、`{ handler, options }`、解绑）；
- `innerHTML` / `textContent`；
- 布尔属性 / 属性移除；
- `ref`（元素 ref → DOM，组件 ref → 公开实例）。

## 8. 内置组件

- **Teleport**：`type.__builtin = 'teleport'`；children patch 到 `resolveTeleportTarget(props.to)`；父容器占位注释 + 目标容器 targetAnchor；支持 `to` 切换与卸载清理；
- **Transition**：`__builtin = 'transition'`；单子节点；enter/leave 类名 + 延迟卸载；
- **TransitionGroup**：把每个子节点包一层 Transition（保留 key），外层默认 `div`（可 `tag`）；enter/leave 复用 Transition，move 动画暂未实现；
- **KeepAlive**：组件实例 / DOM 缓存，`include/exclude`、`max` LRU、`activated/deactivated`；renderer 的 `__keepAlive` 分支负责 storage 移动 / 激活；
- **Suspense / lazy**：Suspense 用模块级栈 + `suspenseCtx`；async `@Setup` 通过 `getCurrentSuspense()` register/resolve；children 常驻，pending 时 `display:none` + fallback；
  `lazy(loader, options)` 支持 `loading` / `error` / `timeout` / `retry` / `retryDelay` / `onError`；在 Suspense 内仍会 register/resolve；
- **Dynamic**：`<Dynamic is={Comp} {...props} />` 按 `is` 渲染组件/标签；
- **ErrorBoundary**：`@Setup` 中注册 `onErrorCaptured`，错误写入 `@Ref error` 后渲染 fallback。

## 9. 错误处理

- `handleError(err, instance, info)`：沿 parent 链调用 `errorCaptured`（返回 false = 已捕获）→ `app.config.errorHandler` → console.error + 上抛；
- setup / render+patch / unmount 全路径 try/catch；
- 子组件挂载期间父 effect 仍 RUNNING 时，Suspense / ErrorBoundary 的状态写入通过 `patchWithRecurse`（临时 `ALLOW_RECURSE`）调度。

## 10. provide / inject

- `provide(key, value)` 在 setup 内调用；首次写入时 copy-on-write 当前注入表；
- `inject(key, default?)` 沿实例注入表查找；
- 类组件通过 `@Provide` / `@Inject` 装饰器使用（见 decorators.md）。

## 11. DevTools

- core 协议：`setDevtoolsHook` / `getDevtoolsHook`，hook 为空时零开销；
- 事件：app mount/unmount、component mount/update/unmount、render effect + computed 的 track/trigger、performance；
- `@actview/devtools` backend 负责收集 app/component 树、事件 ring buffer、状态快照；暂无面板 / 扩展。

## 12. 验证

- `packages/core/__tests__`：renderer 15 + m2 23 + m3 9 + m3b 6 + m3c 4 + class 3 + decorators 4 + guard 3 = 67；
- 全仓 `pnpm test`：450 passed / 4 skipped；
- `pnpm typecheck` / `pnpm build` / `pnpm build:packages` 全绿。

## 13. 当前限制

- 无 SSR / hydrate / HMR / 静态分析；
- 同 target 多 Teleport 的顺序按挂载顺序；Teleport × KeepAlive 组合属边界；
- Transition 在被整体移除的子树内 leave 会中断；
- `patchComponent` / `patchElement` 仍内聚在 `runtime/patch/index.ts`（与 children diff/unmount/KeepAlive 强耦合），`patchProps` 已独立。
