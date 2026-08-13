# 组件运行时增强实现原理

> 源码：`packages/core/src/runtime/`（`keepAlive.ts`、`transition.ts`、`suspense.ts`、`mountComponent.ts`、`renderer.ts`、`lifecycle.ts`）
> 覆盖 KeepAlive（include/exclude/max）、Transition（mode/appear/JS 钩子）、TransitionGroup、Suspense（异步 setup）、生命周期补全。

---

## 1. KeepAlive（缓存组件实例与 DOM）

### 1.1 机制

```
<KeepAlive><component is={cur} /></KeepAlive>
  render：给子 vnode 打 __keepAlive 标记（cache/storage/key/max）
  unmount（renderer 检测标记）：DOM 移入隐藏容器 storage，实例保留（effect 不停）
  切回命中缓存：更新 props + DOM 移回 + instance.update() + activated
```

- **缓存 key**：`child.key ?? realType`（动态组件解析后的真实类型）
- **失活**：renderer `unmount` 缓存分支触发 `invokeHooks(vnode.component.deactivated)`
- **激活**：KeepAlive 命中缓存触发 `invokeHooks(instance.activated)`

### 1.2 include / exclude（组件名匹配）

```ts
function matches(pattern, name) {
  if (Array.isArray(pattern)) return pattern.some(p => matches(p, name))
  if (pattern instanceof RegExp) return pattern.test(name)
  if (typeof pattern === 'string') return pattern.split(',').map(s => s.trim()).includes(name)
}
```

组件名来源：`defineComponent(fn, name)` 的第二参数（Babel 从变量名传递，避免内层函数被重命名）。

### 1.3 max（LRU 淘汰）

- 缓存用 `Map`（插入顺序即 LRU 序），命中时 `delete + set` 移到末尾
- renderer 缓存分支：`cache.size > max` 时 `while` 淘汰最旧（`cache.keys().next()`），调用 `unmount` 真正销毁

---

## 2. Transition（单子节点过渡）

### 2.1 CSS 类模式

```
进入：插入 DOM → +enter-from/-active → rAF×2 → +enter-to → transitionend/时长兜底 → 清理
离开：+leave-from/-active → rAF×2 → +leave-to → transitionend → 移除 DOM
```

- 双 rAF：确保 enter-from 类生效后再切 enter-to（对齐 Vue）
- 无时长（`transitionDuration: 0s`）立即完成

### 2.2 JS 钩子模式

```ts
function playEnter(el, props) {
  if (props.onEnter) {
    props.onBeforeEnter?.(el)
    props.onEnter(el, () => props.onAfterEnter?.(el))   // done 回调
    return
  }
  // 否则走 CSS 类
}
```

`onEnter(el, done)` 的 `done()` 触发 `onAfterEnter`；离开同理（`onLeave(el, done)` 后 `onAfterLeave` + `onDone` 移除 DOM）。

### 2.3 mode="out-in"

```
patchTransition:
  oldChildren 先 leaveAll（全部离开完成后回调）
  mode==='out-in' → mountNew 放在 leaveAll 的 onAllDone
  默认/in-out → 先 mountNew + enter，同时 leaveAll 旧
```

`leaveAll` 收集 pending 元素，每个 `playLeave` 完成后移除 DOM + 从 pending 删，全部完成才 `onAllDone`。

### 2.4 appear

默认首次挂载**不**播放 enter（对齐 Vue），`appear` 才 `playEnter`。

---

## 3. TransitionGroup（列表增删过渡）

### 3.1 机制（标记 + unmount 拦截）

```ts
TransitionGroup = defineComponent(props => () => {
  // 给每个子 vnode 打 __transitionGroup 标记
  for (const c of list) c.__transitionGroup = { name: props.name }
  return Fragment { children: list }
})
```

renderer 的 `unmount` 检测 `vnode.__transitionGroup`：

```ts
if (transitionGroup) {
  playLeave(el, transitionGroup, () => {
    el.parentNode.removeChild(el)
    vnode.component?.unmount?.()
  })
  return   // 延迟卸载（播放离开动画）
}
```

列表 diff 删除节点时，节点走 unmount → 命中标记 → 播放 leave 后延迟移除（而非立即删）。

---

## 4. Suspense（异步 setup + 嵌套）

### 4.1 异步 setup

```ts
// mountComponent 里
const setupResult = options.__setup(props, ctx)
if (setupResult && typeof setupResult.then === 'function') {
  const suspense = getCurrentSuspense()
  suspense?.suspenseCtx?.register()      // pending = true
  instance.render = () => null            // 占位
  setupResult.then(render => {
    instance.render = render
    suspense?.suspenseCtx?.resolve()      // pending = false
    instance.update()
  })
}
```

`defineComponent(async function () { await ...; return () => JSX })` 的 setup 返回 Promise<render>。

### 4.2 children 保持挂载（防死循环）

Suspense render 用 Fragment 同时渲染 children 和 fallback，**pending 时 children 用 `display:none` 隐藏而非卸载**：

```ts
return Fragment {
  children: [
    div { style: pending ? { display: 'none' } : null, children: [children] },
    pending ? fallback : null
  ]
}
```

**关键**：若用 `pending ? fallback : children`（replace 切换），异步组件会被卸载重挂 → setup 反复执行 → 死循环。保持挂载后 setup 只执行一次。

### 4.3 嵌套

`suspenseStack` 栈式注册（挂载 push、卸载 pop），`getCurrentSuspense` 返回栈顶，嵌套 Suspense 各自独立 pending。

---

## 5. 生命周期补全

| 钩子 | 触发时机 | 实现位置 |
|---|---|---|
| `onBeforeMount` | 首次 render 前 | `mountComponent` runEffect 前 |
| `onActivated` / `onDeactivated` | KeepAlive 缓存恢复/移入 | `keepAlive.ts` + `renderer.ts` |
| `onErrorCaptured` | 子组件渲染错误沿树向上 | `mountComponent` 的 `handleError`（返回 false 停止传播） |
| `onServerPrefetch` | renderToString 阶段 | `renderToString.ts`（同步尽力而为） |
| `onRenderTracked` / `onRenderTriggered` | 依赖收集/触发 | `reactive-system.ts` 的 track/trigger（`effect.instance` 关联组件） |

`ComponentInstance` 增加对应钩子数组，`invokeHooks` 用 `pauseTracking` 包裹（防钩子内读写响应式导致自触发循环）。

---

## 6. 设计取舍

| 项 | 决策 |
|---|---|
| TransitionGroup | 标记 + unmount 拦截（不重写列表 diff，复用 renderer 的 keyed diff） |
| Suspense | children 保持挂载（display 切换），避免卸载重挂 |
| 组件 state 展示 | DevTools 不展示（组合式闭包），用响应式事件流替代 |
| in-out mode | 简化为「先 enter 新 + 同时 leave 旧」（精确「enter 完成后才 leave」未实现） |
