# Provide / Inject（依赖注入）

> 状态：✅ 已实施（verify 场景 32，6 用例）
> 目标：跨组件层级传递数据，避免「props 逐层透传」的中间组件样板代码（prop drilling）。

---

## 1. 背景

多层组件树中，深层组件需要祖先的数据（主题、语言、配置、事件总线等）。逐层 `props` 透传要求中间每一层声明并转发，既啰嗦又易漏。

**provide/inject**：祖先在 setup 中**提供**键值，任意后代在 setup 中**注入**读取，中间组件无需参与。

---

## 2. API 形态

```tsx
import { provide } from 'actview'

// 提供方：setup 顶层同步调用（与生命周期钩子一致）
function ThemeProvider() {
  provide('theme', 'dark')
  return <Child />
}

// 消费方：任意层级后代直接读取
function Button(_props: any, ctx?: any) {
  return <button class={ctx.injects.theme === 'dark' ? 'btn-dark' : 'btn-light'}>go</button>
}
```

| API | 说明 |
|---|---|
| `provide(key, value)`（顶层导入） | 提供注入值；同名覆盖继承值、新 key 添加。**只能在组件 setup 中调用**（setup 外调用 warn 且不生效） |
| `ctx.injects`（setup 第二参数） | 注入表（只读约定）；继承自最近提供方 |

- 函数形态（`defineComponent(fn)`）与 options 形态（`defineComponent({ props, setup })`）都可用
- 消费方组件第二参 `ctx` 建议写**可选**（`ctx?: any`）——JSX 组件类型要求单参可调用

---

## 3. 使用场景

| 场景 | 示例 |
|---|---|
| 主题 / 配置全局状态 | 根组件 `provide('theme', ...)`，深层按钮/卡片直接读 |
| 语言 / 文案 | 多语言包经 provide 下发，业务组件无需透传 `locale` |
| 服务 / 单例 | 日志器、事件总线、API 客户端注入 |
| 组件库内部约定 | 表单容器 provide 校验上下文，表单项注入注册 |
| 覆盖默认值 | 中间组件对继承的 key 提供新值（见「规则」） |

### 响应式注入

`injects` 本身是普通对象（不 track/trigger，性能优先）；要响应式就提供 `ref`，子组件读 `.value` 天然联动更新：

```tsx
import { provide, ref } from 'actview'

function Provider() {
  const count = ref(0)
  provide('count', count)     // 提供 ref
  return <Counter />
}
function Counter(_props: any, ctx?: any) {
  return <p>{ctx.injects.count.value}</p>   // count 变化 → 自动重渲染
}
```

---

## 4. 规则（继承 / 覆盖 / 隔离）

```
A provide(x=1, y=2)
 └─ B（不 provide）          → 共享 A 的注入表引用（零拷贝）
     └─ C provide(x=9)      → 拷贝 A 的表 → {x:9, y:2}（x 覆盖、y 保留）
         └─ D               → 看到 C 的表 {x:9, y:2}
```

- **继承**：挂载时 `instance.injects = parent?.injects ?? {}`（根组件为空表）
- **覆盖**：provide 同名 key → 覆盖继承值
- **新增**：provide 新 key → 添加，不影响继承的其他 key
- **隔离（copy-on-write）**：C 的覆盖只在 C 自己的副本上生效，**A/B 的表不被污染**——B 与 D 看到不同的 x（边界快照，对齐 Vue 3）
- **透传**：不 provide 的组件是「纯转发」，子孙拿到的是同一张表（引用相等）

---

## 5. 实现原理

### 5.1 父实例沿渲染器传递（方案 2：挂载参数传递）

`parent` 是组件实例字段，由渲染器在**挂载路径**上传递，`update` 高频路径零额外开销：

```
mountComponent(vnode, container, parent)      // 挂载时显式传入父实例
  └─ instance.parent = parent
  └─ instance.injects = parent?.injects ?? {}
  └─ update() → patch(subTree, container, instance)   // 子树 children 的父 = 本组件
      └─ patch / patchChildren / patchKeyedChildren / replace
          └─ mountVNode(vnode, container, parent)
              └─ mountComponent(子 vnode, container, parent)   // 子组件拿到父实例
```

贯穿链路：`patch → mountVNode → mountComponent`（及 `patchVNode/patchChildren/patchKeyedChildren/replace/patchComponent` 更新分支）。Teleport / Transition 的 children 经 `patchChildrenSafe` 同样透传。

> 为什么不用「实例栈」：每次 `update()` push/pop 会有全局状态开销；方案 2 在低频的挂载路径传参，渲染（高频）路径零成本，且子组件显式知道父级是谁、不依赖全局。

### 5.2 provide：顶层 API + copy-on-write 懒拷贝

`provide` 复用生命周期钩子的 `currentInstance` 上下文机制（`getCurrentInstance`），在 setup 期间拿到组件实例：

```ts
export function provide(key, value) {
  const instance = getCurrentInstance()
  if (!instance) {
    console.warn('[actview] provide 只能在组件 setup 中调用')
    return
  }
  if (instance.injects === instance.parent?.injects) {
    instance.injects = { ...instance.injects }   // 首次 provide 才拷贝（一次 O(链长)）
  }
  instance.injects[key] = value                  // 覆盖/新增 = 一次赋值
}
```

- **未调用 provide 的组件**：`injects` 直接复用父引用——整条链共享一张表，零拷贝、零分配
- **首次 provide**：浅拷贝继承表成自己的副本，之后 O(1) 写入
- 覆盖与新增统一为一次赋值（JS 对象属性天然语义）

### 5.3 ctx.injects 是 live getter

```ts
instance.render = options.__setup(props, {
  attrs,
  get injects() { return instance.injects }   // 实时指向最新表
})
```

若传 setup 时的快照引用，组件**自己** provide 后再读 `ctx.injects.xxx` 会拿到旧表。getter 保证 `ctx.injects` 永远指向当前表（复制后读到的就是自己的新表）。

### 5.4 数据流总结

```
组件挂载链（低频）   parent/injects 引用传递
组件 setup（一次）   provide 惰性拷贝（仅提供方）+ 写入
组件渲染链（高频）   无任何注入相关开销
```

---

## 6. 约定与限制

| 项 | 说明 |
|---|---|
| provide 调用时机 | 仅在组件 setup 顶层**同步**调用（与生命周期钩子一致，复用 currentInstance 上下文）；setup 外调用 warn 且不生效 |
| injects 只读 | 直接写 `ctx.injects.x = ...` 会写进共享表（污染祖先/兄弟），约定只读；要修改应通过 provide |
| 非响应式 | `injects` 是普通对象，不参与依赖收集；响应式需求用 `ref` 注入 |
| 快照语义 | 组件边界拷贝后，祖先后续新增的 key 后代看不到（对齐 Vue 3 组件边界语义） |
| KeepAlive 缓存 | 缓存实例跨卸载保留其注入表；因 KeepAlive 的父实例不变，语义与首挂一致 |
| SSR / renderToString | 静态生成无父子链（顶层递归），provide 落到当前实例自己的表、子孙串行化时不可见（已知限制）；ctx.injects 为空表，不崩 |

## 7. 验证（verify 场景 32）

1. 父 provide → 孙组件跨中间组件读取
2. 未 provide 的中间组件共享父注入引用（断言 `===`，零拷贝）
3. 同名覆盖继承值 + copy-on-write 不污染父表（断言 `!==` + 父值不变）
4. 新增 key 保留继承的其他 key
5. 根组件（无父）injects 为空对象
6. provide `ref` → 注入保持响应式，更新驱动 DOM
7. setup 外调用 provide → warn 且不生效

## 8. 与 Vue 3 对照

| 项 | Vue 3 | ActView |
|---|---|---|
| API | `provide(key, val)` / `inject(key, default)` | 顶层 `provide(key, val)` / `ctx.injects` |
| 注入默认值 | `inject(key, default)` | 无（读不到为 `undefined`，可用 `??` 兜底） |
| 响应式 | 默认非响应式（传 ref） | 同左 |
| 组件边界快照 | 提供方重渲染时注入值保持 | 同左（惰性拷贝表） |
| 性能 | provide 使用响应式对象存储 | 未 provide 组件零拷贝共享引用（惰性 copy-on-write） |
