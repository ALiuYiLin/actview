# 响应式系统实现原理

> 源码：`packages/core/src/reactivity/`（`reactive.ts`、`reactive-system.ts`、`ref.ts`、`computed.ts`、`watch.ts`、`effectScope.ts`）
> 对标 Vue 3 reactivity，设计取舍见文末。

---

## 1. 总览

响应式系统回答两个问题：**谁在读数据？数据变了叫谁？**

```
reactive(obj)  → Proxy 包装（get/set/deleteProperty/has/ownKeys 陷阱）
  读 → track(target, key)   把「当前 activeEffect」记入依赖
  写 → trigger(target, key) 通知依赖里的 effect 重跑
```

- **依赖表**：`targetMap: WeakMap<object, Map<key, Set<ReactiveEffect>>>`（WeakMap 自动回收目标）
- **effect**：`ReactiveEffect` 封装副作用函数，`run()` 执行时设为 `activeEffect`，期间读到的响应式数据都会 `track` 到它
- **调度**：`trigger` 里 effect 有 `scheduler` 就走调度（组件更新入微任务队列），否则同步执行

---

## 2. Proxy 代理层（reactive.ts）

### 2.1 类型判定与可代理性

```ts
function shouldReactive(v): boolean {
  if (!isObject(v) || v[SKIP] || !Object.isExtensible(v)) return false
  const type = targetTypeMap(getRawType(v))  // Object/Array=COMMON, Map/Set/...=COLLECTION, 其余=INVALID
  if (type === COLLECTION) return true
  if (type === INVALID) return false
  if (Array.isArray(v)) return true
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null  // 仅「真·普通对象」
}
```

关键：**class 实例（如 `RefImpl`）不代理**——`proto !== Object.prototype`。这是「`toRef` 对已是 ref 的属性原样返回」等语义的基础。

### 2.2 惰性深代理 + 缓存

- 四个缓存 WeakMap：`reactiveMap` / `shallowReactiveMap` / `readonlyMap` / `shallowReadonlyMap`
- 读取嵌套值时**惰性**创建子代理（`get` 里 `shouldReactive(value) ? reactive(value) : value`）
- 幂等：`reactive(proxy)` 返回原 proxy（`target[RAW]` 标记判断）

### 2.3 内部标记（对齐 Vue 3 ReactiveFlags）

```ts
const RAW = '__v_raw'           // toRaw 递归解包
const IS_REACTIVE = '__v_isReactive'
const IS_READONLY = '__v_isReadonly'
const IS_SHALLOW = '__v_isShallow'
const SKIP = '__v_skip'         // markRaw 标记
```

`get` 陷阱里对这些字符串 key 特殊处理，返回标记值而非走 `track`。

### 2.4 数组 instrumentation

- **修改方法**（push/pop/shift/unshift/splice/sort/reverse）：`pauseTracking()` 包裹——避免 effect 内改自身依赖时把「修改过程内部读取」收集进当前 effect
- **identity 方法**（indexOf/includes/lastIndexOf）：先 `track` 全部索引，再用原始 args 跑；未命中时 `args.map(toRaw)` 再跑——解决「`reactive([obj]).includes(obj)`」对 reactive 元素的比较

### 2.5 集合代理（Map/Set/WeakMap/WeakSet）

集合的响应式与对象不同：`size`、迭代、增删都依赖 **ITERATE_KEY** 依赖。

- `get` 陷阱返回 `instrumentations` 里的方法（get/set/add/has/delete/clear/forEach/keys/values/entries/Symbol.iterator）
- `size` 用 `Reflect.get(target, key, target)`（receiver 必须原始对象，否则 `Map.prototype.size` 抛错）
- `set` 新增 key → `trigger(key) + trigger(ITERATE_KEY)`；更新已有 → 只 `trigger(key)`
- 迭代器返回包装迭代器（`wrapIterator` / `wrapEntriesIterator`），逐个 wrap 值

---

## 3. 依赖收集 / 触发（reactive-system.ts）

### 3.1 track

```ts
export function track(target, key) {
  if (!activeEffect || !shouldTrack) return
  // 调试钩子 onRenderTracked（DevTools 埋点）
  let depsMap = targetMap.get(target) ?? 新建
  let dep = depsMap.get(key) ?? 新建 Set
  if (!dep.has(activeEffect)) { dep.add(activeEffect); activeEffect.deps.push(dep) }
}
```

### 3.2 trigger

```ts
export function trigger(target, key) {
  const effects = new Set(dep)   // 拷贝，防执行中增删
  effects.forEach(e => e.scheduler ? e.scheduler(e) : e.run())
}
```

### 3.3 ReactiveEffect

- `run()`：`cleanupEffect`（清旧依赖）→ 设 `activeEffect` → 执行 fn → **finally 恢复**（抛错也恢复，防级联污染）
- `stop()`：清空依赖，之后不响应
- `scheduler`：设置后 trigger 走调度（组件更新入 `queueJob` 微任务队列去重）

### 3.4 调度批处理

```
trigger → queueJob(effect)  （Set 去重，跳过非 active）
        → 微任务 flushJobs → 逐个 effect.run()
nextTick(cb) 返回本轮 flush 结束的 Promise
```

组件 render effect 用 `scheduler: queueJob`，实现「同轮多次修改只触发一次更新」。

---

## 4. ref / computed / watch

### 4.1 ref

- `RefImpl`：`value` getter `track(this, 'value')`，setter `Object.is` 变化才 `trigger`
- 对象值自动 `reactive` 包装（`toReactive`）
- `shallowRef`：对象值不包装（`__v_isShallow` 标记），内部属性变化不触发，需 `triggerRef`
- `toRef`/`toRefs`：`ObjectRefImpl` 读写委托源对象（走源代理的 get/set 陷阱，天然响应式）

### 4.2 computed

- 基于 `ReactiveEffect` + **脏标记 `_dirty`** 惰性缓存
- 读 `value` 才求值（`_dirty` 时 `effect.run()`），依赖不变直接返回缓存
- 依赖变化 → scheduler 置脏 + `trigger(this, 'value')` 通知外层读取者
- 可写：`computed({ get, set })` 赋值走 setter

### 4.3 watch / watchEffect

- `watch(source, cb, options)`：`createGetter` 把 source 归一化为 getter（ref 取 `.value`、函数原样、对象深遍历 `traverse`、数组逐项）
- 默认异步（微任务），`flush: 'sync'` 同步、`'post'` 等组件 flush 后（`nextTick` 后）
- `deep: true` 对 getter/ref 源 `traverse`；对象源默认 deep
- `onCleanup` 第三参 + `onWatcherCleanup`（模块级 `currentWatcher`）两种清理注册
- `once: true` 回调后自动 stop

---

## 5. EffectScope（effectScope.ts）

- 组件实例持 scope，setup 期间创建的 watch/computed/render effect 自动注册，卸载时 `scope.stop()` 一并停止
- 嵌套：`parent` 链 + `on()`/`off()` 切换 `activeEffectScope`
- `effectScope()` 创建 + `scope.run(fn)` 激活执行；`onScopeDispose` 注册清理（stop 时执行）

---

## 6. 设计取舍（与 Vue 3 的差异）

| 项 | 决策 |
|---|---|
| ref 在 reactive 内自动解包 | ❌ 不做，保持显式 `.value` |
| `customRef` | ❌ 砍（精简） |
| 合成事件 | ❌ 砍（原生事件直连） |
| watch `onTrack`/`onTrigger` | ❌ 砍（调试用 `onRenderTracked`/`onRenderTriggered` 替代） |

> 判型工具（`toRaw`/`isReactive`/`isReadonly`/`isProxy`/`isShallow`）依赖 `RAW`/`IS_REACTIVE` 等标记；`toRaw` 递归解包「readonly(reactive(obj))」到原始对象。
