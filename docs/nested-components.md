# 嵌套组件设计（Nested Components）

> 状态：✅ 已实现（Babel 插件 + mountComponent 配套）
> 关联：`docs/babel-defineComponent.md`（编译期转换规则）、`packages/core/src/runtime/mountComponent.ts`（`normalizeSetupResult`）

---

## 1. 背景与设计决策

ActView 组件有两种合法写法（`__setup` 的返回形态）：

| 形态 | 源码 | 编译后 | 运行时语义 |
|---|---|---|---|
| **简写组件** | `function A() { return <JSX/> }` | `defineComponent(function(){ return () => <JSX/> })` | `__setup` 返回 **render 函数** |
| **setup 风格组件** | `function B() { ...; return function(){ return <JSX/> } }` | `defineComponent(function(){ return defineComponent(function(){ return () => <JSX/> }) })` | `__setup` 返回 **内部组件对象**（嵌套组件） |

**设计决策（用户拍板）**：setup 风格的渲染函数**包装为嵌套组件**（而非原样保留为 render 函数）——渲染函数因此获得**组件能力**（内部 setup、生命周期钩子、独立实例与 effect 作用域）。

---

## 2. 嵌套组件是什么

```tsx
// 源码：setup 风格（最后 return 渲染函数）
function Section(props) {
  const theme = useData().theme
  return function () {
    onMounted(() => measure())          // 渲染函数拥有组件能力
    const open = ref(false)             // 独立实例状态
    return <div class="section">{theme.value}</div>
  }
}
```

```js
// 编译后：渲染函数被嵌套包装为 defineComponent
const Section = defineComponent(function (props) {
  const theme = useData().theme
  return defineComponent(function () {
    onMounted(() => measure())
    const open = ref(false)
    return () => <div class="section">{theme.value}</div>
  })
})
```

```js
// 运行时（mountComponent.normalizeSetupResult）：
// 外层 __setup(props) 返回内部组件对象 =》 render 返回组件 vnode：
{ type: 内部组件, props: { ...外层props } }   // props 透传
// =》 patch =》 递归 mountComponent（嵌套挂载）
```

**「组件返回组件」链式成立**——嵌套层数不限（每层递归遵循同一规则）。

---

## 3. 实现细节

### 3.1 Babel 插件（`wrapComponentFn` 的 `isRenderFn` 分支）

最后 return 是函数（渲染函数）时递归调用 `wrapComponentFn`：

```js
const inner = wrapComponentFn(ret)   // 渲染函数 → defineComponent(内部组件)
if (inner) last.argument = inner
// 渲染函数非组件形态（如 return function(){ return 1 }）→ 原样保留
```

- 渲染函数内部的 `return JSX` 由递归按「简写组件」规则包成 `() => JSX`
- 渲染函数内部再 return 函数 → 递归继续嵌套（浅嵌套约定见 §4）

### 3.2 mountComponent（`normalizeSetupResult`）

```js
function normalizeSetupResult(result, props) {
  if (typeof result === 'function') return result              // render 函数
  if (result?.__setup === 'function') {
    return () => ({ type: result, props: { ...props } })       // 嵌套组件（透传 props）
  }
  if (result?.$$typeof) return () => result                    // vnode
  return () => null
}
```

| `__setup` 返回 | 处理 |
|---|---|
| 函数 | render 函数（原样） |
| 组件对象（defineComponent） | 包成组件 vnode，**props 透传外层**，递归挂载 |
| vnode | 直接渲染 |
| 其他（null/undefined） | `() => null` |

### 3.3 更新链路

- **外层 props 变化** → 外层 `update()` → `render()` 返回新 vnode（type 同、props 新）→ `patchComponent` → `isSameProps` 不同 → `updateProps` + 内层 `update()` → **内层重渲染**
- **内层读外层响应式**（ref/reactive 闭包）→ 内层渲染 effect 直接 track → 响应式变化 → **内层 effect 触发重渲染**（不经外层）
- **实例复用**：内部 defineComponent 对象由外层 `__setup` 创建一次（setup 只执行一次）→ type 引用稳定 → patch 复用实例，**不重建**

---

## 4. 契约与限制

### 契约（用户必须遵守）

1. **取数通道**：
   - **props 透传**：内层 `innerProps` 收到外层 props（外层 props 变化会更新内层）
   - **闭包 + 响应式**：内层渲染函数读外层 ref/reactive → 自动响应更新
2. **非响应式局部变量是快照**：外层 `setup` 只执行一次，`const n = 1` 是挂载时的值；需要动态 → 用 ref/reactive
3. **浅嵌套约定**：递归包装每层都包一层 defineComponent——**深层嵌套（>2 层）不推荐**（每层多一个组件实例开销）；设计上每层独立组件能力可用

### 已验证行为（verify 场景 30）

| 场景 | 结果 |
|---|---|
| `__setup` 返回内部组件对象 | ✅ 嵌套渲染 |
| 3 层组件链（L1→L2→L3） | ✅ 正常渲染 |
| `__setup` 直接返回 vnode | ✅ 渲染 |
| 嵌套组件 props 透传 + 外层 props 更新 | ✅ 内层收到并更新 |
| 内层读外层响应式（count 变化） | ✅ 只重渲染，innerSetup/onMounted 不重复 |

### 已知限制

| 限制 | 说明 |
|---|---|
| 深层嵌套开销 | 每层一个组件实例（effect/scope）；过度嵌套有性能损耗 |
| 无法「按需跳过渲染」 | 内层没有类似 `shouldUpdate` 的开关（与 Vue 相同，接受） |
| 编辑器不拦截非法写法 | `return function(){ return function(){...} }` 是合法嵌套（只是深）；TS 类型无法表达「返回不能是函数」的负向约束（见 §5） |

---

## 5. 为什么 TS 类型无法拦截「非法嵌套」

```ts
function X() { return function() { return <JSX/> } }
```

类型是 `() => (() => VNode)`——与合法 render 函数 `() => VNode` **在类型层面不冲突**（都满足「返回函数的函数」或「函数」）。TS 无法表达「返回值不能是函数」的负向约束。若需编辑器即时反馈，只能走 ESLint 自定义规则（`actview/no-nested-render-fn`，规划中）。

---

## 6. 相关文档

- `docs/babel-defineComponent.md` — 编译期转换规则（12 种场景，含嵌套产物）
- `docs/API.md` — API 清单（组件能力）
- 插件转换测试：`plugins/plugin/test/plugin.test.ts`
- 运行时验证：`scripts/verify.test.tsx` 场景 30
