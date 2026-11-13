# 类组件 + 装饰器方案设计（Class Component / Decorator Proposal）

> 状态：**设计分析草案，不涉及任何源码改动**。
> 本文回答：类组件 + `@Ref` / 生命周期装饰器 + 删除 Babel wrap + 渲染器接线，是否可行、怎么落地、代价与风险是什么。
>
> 相关现状文档：`docs/compiler-layers.md`、`docs/renderer-design.md`、`docs/types-architecture.md`。
> 当前工作区里 `tsconfig.base.json` 已有未提交的 `experimentalDecorators: true` + `emitDecoratorMetadata: true`（下文会分析它们的影响）。

---

## 0. 结论（TL;DR）

1. **决策已拍板：类组件单一路径。** 保留 Babel（构建链/工具链），**只删除 L1 wrap 阶段**；组件全部迁移为类，**不再保留 `defineComponent` 与函数组件路径**（含内部内置组件）。
2. **`@Ref` 由“装饰器元数据 + 渲染器安装每实例 accessor”实现（推荐，不使用实例 Proxy）。** 关键实测：`target: es2023` 默认 `useDefineForClassFields: true` 会让类字段 initializer 创建 own data property，**遮蔽原型 getter/setter**；所以不能只靠原型描述符。渲染器在 `new Ctor()` 后摘掉 own 字段、安装 accessor（闭包持有 `ref`），语义与类型都正确：
   - `#private` 字段、方法绑定、`instanceof`、调试器的 `this` 都不会被 Proxy 破坏；
   - 字段的 TS 类型仍是 `number`（`this.count` 类型正确），运行时由 accessor 维持 `ref`；
   - 不依赖 `useDefineForClassFields` 全局配置，也不影响普通类；
   - 单次属性访问成本接近 `ref.value`，没有 Proxy trap 开销。
3. **工具链结论（本机实测，见 §4）**：
   - 目标 API 里的 `@Ref count = 0`（字段装饰器 + 渲染器安装 accessor）对应 **legacy decorators**，与当前 `experimentalDecorators: true` 一致；esbuild 0.25/0.27 可直接降级，Babel 也可承担；
   - **保留 Babel ≠ 保留 L1 wrap**：本次删除的是 wrap 插件/阶段，Babel 作为装饰器降级、静态分析或其它 transform 工具继续保留；
   - Stage-3 装饰器需要 `accessor` 语法并关闭 `experimentalDecorators`，Babel 也可支持，但会改变 §2 的字段写法（`@Ref accessor count = 0`）；本版按 §2 目标形态选择 legacy。
4. **“删除 Babel wrap”成立的前提已经满足**：组件全部改为类，运行时直接识别 class，不再需要编译期把函数包成 `defineComponent`；函数组件路径删除后，L1 wrap 没有存在必要。
5. **静态分析价值真实但有限**：类 + `@Component` 让“组件边界”变成显式 AST 事实（不用猜 PascalCase / 不用猜 return 的是不是 JSX），适合做 DevTools 清单、props 校验、路由/文档生成、HMR 元数据；但装饰器仍可被别名/动态引用，静态分析器需要额外解析约定。**收益来自“显式声明”，不来自“类”本身。**
6. 目标形态（详见 §2）：**只保留类组件**
   - 类 + `@Component` 装饰器 + `@Ref`/`@Reactive`/`@Computed`/`@Watch`/生命周期装饰器；
   - 删除 `defineComponent` 公开 API、函数组件、`ComponentFunction`/`ComponentTag` 的“函数视图”；
   - 删除 L1 wrap 插件与 Babel 的 wrap 步骤；
   - Babel 保留：可做装饰器降级、AST 静态分析（组件 manifest）或后续 transform；
   - 目标 API 以 §2 为准（`import { Component, Ref, ... } from '@actview/core'`）。

---

## 0.1 决策记录（2026-11-12，已拍板）

用户确认以下方向，覆盖后文所有旧建议（尤其 §8/§9/§11 中“双模式 / 保留函数组件 / 保留 `defineComponent`”的备选方案）：

| # | 决策 | 结果 |
|---|---|---|
| D1 | **保留 Babel，只删除 L1 wrap 阶段** | Babel 依赖/`@actview/compiler` 包保留，职责改为装饰器降级、AST 静态分析或其它 transform；**wrap visitor 与 Vite 的组件包装步骤删除** |
| D2 | **组件全部迁移为类，不保留 `defineComponent`** | 公开 API 删除 `defineComponent`、函数组件与 `ComponentFunction`/`ComponentTag` 函数视图；内部内置组件（KeepAlive/Suspense/ErrorBoundary/lazy 等）同步类化 |
| D3 | **`@Ref` 按推荐实现** | 字段装饰器只记录元数据，渲染器在 `new Ctor()` 后摘掉 own 字段并安装每实例 accessor（闭包持有 `Ref`）；`this.count: number`；**不使用实例 Proxy** |
| D4 | **目标 API 以 §2 为准** | `Component, Ref, Reactive, Computed, Watch, Setup, Mounted, Updated, Unmounted, Prop` 与 `ActViewComponent` 从 `@actview/core` 导出；§2 的 `Counter` 即目标形态 |

**本决策带来的直接后果（后文按此修订）：**

- 不存在“函数组件显式 `defineComponent`”的过渡形态；所有组件类化，测试、示例、内置组件全部迁移；
- Babel 保留不等于保留 wrap；`@actview/compiler` 可以继续存在，但只做 AST/静态分析或装饰器 transform；
- `ComponentProps` / JSX `ElementType` 只保留 class 构造器 + 内置标记（Teleport/Transition 等），函数组件类型删除；
- 迁移是 breaking change，需要 changeset（建议 major）与迁移指南；
- §9 的 Phase 0–4 已按“类组件单一路径”重写。

---

## 1. 现状盘点（为什么“包装不可靠”这个判断基本成立）

### 1.1 当前组件模型

- 运行时组件 = 带 `__actview_component` 标记的 **setup 函数**，`defineComponent` 只写标记、原样返回函数：`packages/packages/core/src/runtime/component.ts:39-91`。
- 渲染器在 `mountComponent` 里创建实例 → `setupComponent(instance)` 执行一次 setup → `instance.render` 是 render 函数 → `setupRenderEffect` 用 render effect 驱动 patch：`packages/core/src/runtime/patch/index.ts:783-912`、`packages/core/src/runtime/component.ts:155-212`。
- 组件识别唯一入口 `isComponent` 只看函数对象上的标记：`packages/packages/core/src/runtime/component.ts:86-91`；`createApp` 也用它校验根组件：`packages/core/src/app.ts:62-66`。

### 1.2 当前 L1 wrap 的启发式

- 只处理 **PascalCase 名字** 的函数声明/变量声明/默认导出：`packages/compiler/src/wrap.ts:41-46`、`264-283`、`287-310`、`312-349`；
- 把函数体里的 **return 表达式改写为 `return () => <expr>`**，并追加 `return () => null`，剥掉返回类型：`wrap.ts:138-186`；
- 自动注入 `defineComponent` import：`wrap.ts:242-260`；
- 不处理类方法、对象属性、内联函数、三元/HOC 里的函数值等：`wrap.ts:20-27` 注释明确。
- 它本质是**名字启发式 + AST 重写 + 输出代码形状变化**，因此：
  - 嵌套的 PascalCase helper 会被误判为组件；
  - 小写函数返回 JSX 不会被当作组件（反之 PascalCase 工具函数会被包装）；
  - 函数组件写法的边界不清晰，取决于命名；
  - 改写 return 会改变 source map / 堆栈 / 调试体验；
  - 编译产物依赖 Babel，Vite 插件必须 `enforce: 'pre'`：`packages/compiler/src/vite.ts:40-41`、`vite.config.ts:8-16`。

### 1.3 现有类型层

- `ElementType = string | symbol | ComponentFunction | ComponentTag`：`packages/packages/core/src/runtime/element.ts:32-37`；
- `ComponentTag = Component & ((props) => any)`（JSX 标签视图要求 call signature）：`element.ts:52-63`；
- `ComponentProps` 通过函数参数 infer：`element.ts:65-74`。
- 这意味着**类构造函数当前无法作为 JSX 标签**（class 类型没有 call signature），必须扩展类型联合。

### 1.4 结论

“包装不可靠”主要批评的是**启发式自动包装**。决策已确定类组件单一路径：组件必须显式类化（`@Component` + `render`），`defineComponent` 与函数组件路径删除。类的收益在于**显式边界 / 生命周期元数据 / 继承 / 静态分析**。

---

## 2. 目标 API（建议形态）

```tsx
// 组件类型按需从 @actview/core（或 @actview/decorators）导入
import {
  Component, Ref, Reactive, Computed, Watch,
  Setup, Mounted, Updated, Unmounted,
  Prop,
} from '@actview/core'
import type { ActViewComponent } from '@actview/core'

export interface CounterProps {
  initial?: number
  step?: number
}

@Component({ name: 'Counter' })          // 类装饰器：注册元数据 + 组件标记
export class Counter extends ActViewComponent<CounterProps> {
  @Prop initial = 0                       // props 访问器：this.initial 读 instance.props
  @Prop step = 1

  @Ref count = 0                          // this.count: number；内部是 ref
  @Reactive profile = { name: 'Ada' }     // 对象字段：this.profile.name 可追踪
  @Ref items: string[] = []

  @Computed get double(): number {        // 惰性 computed，依赖 this.count
    return this.count * 2
  }

  @Watch('count')                         // 方法装饰器：变化时调用
  onCountChange(value: number, old: number) {
    console.log('count', old, '->', value)
  }

  @Setup                                  // 只在实例创建后、首帧前执行一次
  setup() {
    this.count = this.initial
  }

  @Mounted                                // 首帧 DOM 挂载后执行（post flush）
  mounted() {
    console.log('mounted', this.$el)
  }

  @Updated update() {}
  @Unmounted unmounted() {}

  render() {
    return (
      <button onClick={() => (this.count += this.step)}>
        点我 {this.count} / double {this.double}
      </button>
    )
  }
}
```

JSX 里直接使用：

```tsx
const App = () => (
  <div>
    <Counter initial={2} />
    <Counter initial={10} step={5} />
  </div>
)
```

> 上面是**目标语法**，不是当前已实现。类组件同样需要被渲染器识别、需要 JSX 类型支持、需要装饰器元数据被消费。

可选：无装饰器版本（见 §8 替代方案 C），如果装饰器工具链成为阻塞：

```ts
export class Counter extends ActViewComponent<CounterProps> {
  static refs = ['count', 'items'] as const
  static props = { initial: 0, step: 1 }
  count = 0
  items: string[] = []
  setup() { this.count = this.initial }
  render() { return <button>{this.count}</button> }
}
```

---

## 3. 四个核心机制逐一评估

### 3.1 JSX 支持类组件

**可行，改动集中在类型联合 + 运行时识别。**

```ts
// packages/core/src/runtime/element.ts（示意）
export interface ClassComponent<P = Record<string, any>> {
  new (props: P): { render(): Element | null }
}

export type ElementType =
  | string
  | symbol
  | ComponentFunction<any>
  | ComponentTag<any>
  | ClassComponent<any>

export type ComponentProps<C> =
  C extends new (props: infer P) => any ? P
  : C extends (props: infer P, ...rest: any[]) => any ? P
  : {}
```

同时需要：

- `VNode` 的 `type` 类型自然跟随 `ElementType`（`vnode.ts:12-13`）；
- `JSX.ElementType` 直接复用 `RuntimeElementType`（`packages/jsx/src/jsx.ts:69-70`），不需要额外全局命名空间改动；
- `createElement` / `jsx` 运行时只是把 type 存进 VNode，不需要知道是函数还是类。

风险：`ComponentTag` 当前的可调用签名约束用于 JSX 检查。类构造器是 `new` 签名，必须加入联合，否则 `<Counter/>` 报 TS2604/不可作为 JSX 标签。这个改动是纯类型层的，低风险。

### 3.2 渲染器识别与挂载接线

**可行，核心是给 `mountComponent` 加一条 class 分支，复用现有实例/render effect/scheduler/lifecycle。**

```ts
// core/src/component.ts 示意
export function isClassComponent(t: unknown): t is ClassComponentCtor {
  return (
    typeof t === 'function' &&
    !!(t as any).prototype &&
    typeof (t as any).prototype.render === 'function'
  )
}

export function isComponent(t: unknown): t is ComponentLike {
  return isFunctionComponent(t) || isClassComponent(t)
}
```

挂载流程（新增 `mountClassComponent` 或 `mountComponent` 内分支）：

1. `createComponentInstance`（复用现有 uid / props / scope / injects / proxy 骨架）；
2. `initProps(instance, vnode.props)`（复用 `component.ts` 现有逻辑）；
3. `const ctx = new Ctor(instance.props)`（class 构造器可接收 props；也可无参）；
4. `instance.ctx = ctx`；给 ctx 安装内部逃生口（`$`、`$props`、`$el`、`$forceUpdate`、`$nextTick`、`$parent/$root`）；
5. 读类静态元数据（§3.4），在 `instance.scope` 内：
   - 创建 `@Ref` / `@Reactive` / `@Computed` / `@Watch`；
   - 执行 `@Setup` 方法（同步；async 版本走现有 async setup + Suspense 协议）；
   - 把生命周期方法包成闭包 push 到 `instance.mounted` 等数组（复用 `invokeHooks`）；
6. `instance.render = () => ctx.render()`（render 内 `this` 是 ctx，读取 ref 正常 track）；
7. `setupRenderEffect(instance, container, anchor)`（完全复用现有首帧/更新/卸载/错误处理/Suspense/KeepAlive/DevTools 路径）；
8. `instance.proxy` 的设计见 §3.6。

**需要改的边界：**

| 位置 | 改动 |
|---|---|
| `packages/core/src/runtime/element.ts` | 增加 `ClassComponent` 类型、联合、`ComponentProps` 分支 |
| `packages/core/src/runtime/component.ts` | 增加 `isClassComponent` / `ComponentLike`；`ComponentTag` 保持函数视图 |
| `core/src/app.ts` | `createApp` 接受 class 构造器（`assertRootComponent` 扩展） |
| `core/src/component.ts` | 新增 `createClassComponentInstance` / 元数据消费 / `ctx` 字段 |
| `core/src/instance.ts` | `ComponentInternalInstance` 增加 `ctx?: object`（或 `classInstance`），`type` 联合类型 |
| `core/src/renderer.ts` | `mountComponent` 分支；KeepAlive 缓存/激活要按 class/vnode 通用；DevTools name 取 `static displayName/name` |
| `core/src/component.ts` 公共 proxy | 类组件把 class 实例暴露为 public instance（见 §3.6） |
| `isComponent` 调用点 | `createApp`、KeepAlive include/exclude、DevTools、Suspense 等统一走新判定 |

**渲染器已有能力几乎都能复用**：组件级 re-render（render effect）、scheduler、keyed diff/LIS、provide/inject、KeepAlive、Suspense、ErrorBoundary、DevTools 都只依赖 `instance.render` 和生命周期数组，不需要知道组件是函数还是类。

### 3.3 `@Ref` 的三种实现（本方案最关键的细节）

用户设想：“将类实例代理，`this.count` 等价于 `count.value`”。有三种实现路径：

#### 方案 A（推荐）：`@Ref` 只记录元数据，渲染器在构造后安装每实例 accessor

**先看一个会踩坑的实测（本机 TS 6.0.3）：**

- `target: es2023` 默认 `useDefineForClassFields: true`，类字段 `count = 1` 用 **define 语义**创建实例 own data property；它会**遮蔽原型上的 getter/setter**。
- 如果 `@Ref` 直接在 `prototype` 上 `Object.defineProperty` 定义 getter/setter，构造后 `this.count` 仍是普通 own 字段，setter 不会被调用（实测 `hasOwnProperty('count') === true`，响应式失效）。
- 把 `useDefineForClassFields` 改成 `false` 可以让字段初始化走 assignment、命中原型 setter，但这是**全局语义变更**，会影响所有类（字段是否 own、子类覆盖、`Object.hasOwn` 等），不适合作为组件框架的隐式前提。

因此推荐 **渲染器安装 accessor**，不依赖 `useDefineForClassFields`：

```ts
// @Ref 装饰器只做元数据（属性描述符可选，但渲染器会覆盖）
export function Ref(options?: RefOptions) {
  return function (target: any, key: string) {
    getComponentMeta(target).refs.set(key, options ?? {})
  }
}

// 渲染器在 new Ctor() 之后、@Setup / 首帧之前调用
function installRefs(ctx: any, meta: ComponentMeta) {
  for (const [key, options] of meta.refs) {
    const own = Object.getOwnPropertyDescriptor(ctx, key)
    const initial = own?.value
    if (own) delete ctx[key]              // 摘掉 ES2022 own field 遮蔽
    const r = ref(initial, options)
    Object.defineProperty(ctx, key, {
      configurable: true,
      enumerable: true,
      get: () => r.value,
      set: (v) => { r.value = v },
    })
  }
}
```

**为什么这是当前最优：**

- 不依赖 `useDefineForClassFields`：无论字段被 define 还是 assignment 初始化，渲染器都能在实例边界“摘掉 own 字段 + 装 accessor”；
- `this.count` 类型仍是 `number`，运行时是 `ref` 的读写；
- **不需要 Proxy**，`#private`、`instanceof`、方法 `this`、对象身份全部保持正常；
- 只在组件实例上安装，不影响普通类/其他代码；
- `@Setup`、render、事件处理都在安装之后执行，语义一致。

**注意点：**

- **构造函数内部的 `this.count` 还是普通字段**（安装尚未发生）；不要在 constructor 里做响应式读写/依赖收集，初始化放 `@Setup`（目标 API 本来就是 `@Setup` 初始化）；
- 组件必须由渲染器 `new`（`new Counter()` 手动实例化不会安装 accessor；文档明确）；
- 继承：元数据沿原型链合并；基类/子类同名字段覆盖规则需定义；渲染器一次性安装合并后的 refs；
- 未装饰的普通字段就是普通 JS 字段（显式、可预期）；
- `@Reactive` 同理：摘掉 own 字段，安装 accessor 返回 `reactive(initial)`；
- 如果未来选择 `useDefineForClassFields: false`（变体 A0），也可以退回原型描述符实现，但不建议作为默认。

#### 方案 B：类实例 Proxy（用户原始设想）

```ts
// 概念示意：构造后返回 Proxy；@Ref 字段实际存 ref，proxy get/set 解包
function createInstanceProxy(raw: object, meta: ComponentMeta) {
  const bound = new WeakMap<object, Function>()
  return new Proxy(raw, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver)
      if (meta.refs.has(key as string)) {
        return (value as Ref<any>).value
      }
      if (typeof value === 'function') {
        // 关键：方法绑定到 proxy，否则事件回调 this 丢失
        let fn = bound.get(target)
        if (!fn) { fn = value.bind(proxy); bound.set(target, fn) }
        return fn
      }
      return value
    },
    set(target, key, value, receiver) {
      if (meta.refs.has(key as string)) {
        ;(Reflect.get(target, key, receiver) as Ref<any>).value = value
        return true
      }
      return Reflect.set(target, key, value, receiver)
    },
  })
}
```

**优点：**

- 字段可以直接声明为 `ref(0)` 或由装饰器把 initializer 换成 ref，`this.count` 自动解包；
- 可以拦截**未装饰字段**的读写，做到“任意属性都响应式”（类似 `reactive(instance)`）；
- 可以顺便提供 `this.$props` / `this.$refs` 等魔法。

**关键坑（必须在设计阶段决定是否接受）：**

1. **私有字段 `#count` 会炸**：Proxy 不是 raw instance，方法通过 Proxy 调用时 `this` 是 Proxy，访问 `#private` 会抛 `TypeError: Cannot read private member...`。Vue 3 的 `reactive()` 也有同样限制，官方文档明确建议类组件不要用 private 字段，或使用 `reactive` 之外的方案。
2. **方法绑定**：Proxy get 返回未绑定方法时，DOM 事件直接调用会丢 `this`；必须自动 bind（并缓存，保证 add/remove 同一引用）。bind 到 Proxy 又回到第 1 条。
3. **构造期 `this` 是 raw**：类构造器内部（字段初始化、构造器方法调用）拿到的是 raw 实例，此时 `this.count` 仍是 Ref 对象而不会解包；只有构造后的 Proxy 访问才解包。`@Setup` 在 Proxy 创建后执行可以规避，但构造器里写逻辑会“半魔法”。
4. **身份/相等**：`instance === proxy` 不成立，`raw` 与 `proxy` 并存；KeepAlive、ref、`instanceof`、DevTools 都要选一个作为公开身份；class 内部方法如果拿 raw（构造期）与外部拿 proxy 会混淆。
5. **性能**：每次属性访问/方法调用多一层 trap；`reactive` 深层代理还会代理嵌套对象，类实例字段多时成本高于 accessor。
6. **类型**：字段声明为 `number`，运行时是 `Ref`（由装饰器替换 initializer）；类型与运行时不一致，用户如果 `console.log(this)` 看到 Ref 会困惑；如果字段声明为 `Ref<number>`，又失去 `this.count` 是 number 的 DX。

**结论：Proxy 可以实现用户描述的语义，但不是推荐默认。** 如果坚持代理，建议：
- 只代理**公开字段**，文档禁止 `#private`；
- 方法用 `@Bind` 显式绑定或推荐箭头函数字段；
- 构造期不读响应式字段（把初始化放到 `@Setup`）；
- 公开实例明确用 Proxy，raw 不暴露。

#### 方案 C：`accessor` + Stage-3 装饰器

```ts
function Ref(value: any, ctx: ClassFieldDecoratorContext) { ... }
class C { @Ref accessor count = 0 }
```

- 类型最标准、TC39 未来方向；装饰器可拦截 auto-accessor 的 get/set；
- 但 **Stage-3 需要关闭 `experimentalDecorators`**；esbuild 当前不降级（§4），必须引入 Babel/SWC/tsc 转换；
- 与 legacy 装饰器不能混用（TS1240）。

> **推荐：方案 A（渲染器安装每实例 accessor）作为默认；Proxy 明确不采用；Stage-3 作为工具链成熟后的迁移方向。** 方案 A 的关键前提是“组件由渲染器实例化”，这也是框架组件本来就该遵守的边界。

### 3.4 生命周期装饰器与 Setup

**可行。元数据在类定义时收集，实例创建时消费。**

```ts
type LifecycleMethod = keyof LifecycleHooks
interface ComponentMeta {
  name?: string
  refs: Map<string, RefOptions>
  reactive: Set<string>
  computed: Map<string, () => any>
  watch: Array<{ source: string | string[]; method: string; options?: WatchOptions }>
  hooks: Partial<Record<LifecycleType, string[]>>
  setup?: string
  render?: string
  props: Record<string, PropOptions>
}
```

- **方法装饰器**只记录 `(方法名 → 元数据)`，不执行逻辑：`@Setup`、`@Mounted`、`@Updated`、`@Unmounted`、`@BeforeMount`、`@Activated`、`@Deactivated`、`@ErrorCaptured` 等；
- **类装饰器**（`@Component`）在类定义结束时运行（晚于成员装饰器），负责：
  - 合并父类元数据（`Object.getPrototypeOf` 链）；
  - 写入 `static __actview_component_meta__`；
  - 打 `__actview_component` / `__actview_class_component` 标记（供 `isComponent` 快速判断）；
  - 校验 `render` 方法存在、生命周期方法存在；
  - 可选：设置 `static displayName`。
- 实例挂载时：
  1. `new Ctor(props)`（字段初始化 → `@Ref` 装饰器 setter 工作）；
  2. 安装 `instance.ctx` 和 `$` 系列；
  3. 在 `instance.scope.run` 内创建 computed/watch、执行 `@Setup`；
  4. 把生命周期方法注册到现有 `instance.mounted` 等数组（包装成 `() => ctx[name]()`）；
  5. `render` effect 首帧；之后 mounted/unmounted 等顺序与现有函数组件完全一致。
- **顺序**：字段初始化 → 构造器 → `@Setup` → beforeMount → render → mounted → updated → beforeUnmount → unmounted；`@Setup` 必须只跑一次，语义等价现有 setup。
- **async `@Setup`**：可以让 setup 返回 Promise，复用现有 async setup + Suspense 协议（先渲染 null 占位，resolve 后写 render/queueJob）。建议第一版先只支持同步，避免把 class 路径复杂化。
- **装饰器执行顺序坑**：成员装饰器按声明**自底向上**执行；类装饰器最后执行；同一字段多个装饰器顺序也需要文档。元数据合并必须定义“子类覆盖父类”的规则。
- **`@Prop`**：建议用属性装饰器定义 getter（只读）映射 `instance.props`；默认值/类型校验可在元数据里声明。不要依赖 `emitDecoratorMetadata`（esbuild 不支持）。
- **`@Watch`**：在实例 setup 阶段创建 `watch`（来自 `@actview/reactivity`），`stop` 由 `instance.scope` 自动管理；`immediate/deep` 等选项透传。
- **`@Computed`**：getter 装饰器，按实例缓存 `computed(() => originalGetter.call(ctx))`；和 `@Ref` 一样走 `WeakMap`，避免跨实例共享。

### 3.5 静态分析：能做什么、不能做什么

**能做的：**

- 用 TypeScript AST 或 Babel parser 扫描 `@Component` 类，生成组件清单（manifest）：
  ```json
  {
    "name": "Counter",
    "props": { "initial": "number", "step": "number" },
    "refs": ["count", "items"],
    "computed": ["double"],
    "lifecycle": { "mounted": ["mounted"], "unmounted": ["unmounted"] },
    "watchers": [{ "source": "count", "method": "onCountChange" }]
  }
  ```
- 用于：DevTools/文档、路由与代码分割、HMR 边界、SSR 数据、props 校验/默认值、组件库 API 报告、死代码/未使用组件检测。
- 比当前 L1 wrap **更确定**：不需要猜“PascalCase 函数是不是组件”，组件边界由 `@Component` / class + render 明确；不需要改写 return；source map 1:1。
- 可以做成独立 Vite 插件（TS AST），**不需要 Babel 转换**；只在构建期读 AST，产物不做改写（或只输出虚拟 manifest 模块）。

**不能/不容易做的：**

- 装饰器可以被别名/重新导出/动态应用（`const R = Ref`，`applyDecorators(...)`），静态分析必须做标识符解析，否则只能按“名字约定”匹配——这又回到启发式；
- 装饰器参数可以是任意表达式（`@Watch(getSource())`），静态分析只能保守处理；
- 运行时元数据（装饰器实际执行结果）比静态分析更权威；建议“运行时元数据为主，静态分析做构建期增强”；
- tree-shaking：装饰器/类有副作用（类装饰器调用），无用组件不一定能被摇掉；当前 `defineComponent` 调用同样有副作用，差别不大；
- tree-shaking 与“静态分析”不是同一件事；不要用静态分析承诺 bundle 优化。

**结论**：静态分析是类方案的一个真实加分项（显式边界 + 元数据），但收益主要来自“显式组件声明”，不是“类语法”；不要把它当作替换 L1 的唯一理由。

### 3.6 公开实例、refs 与组件 ref

- 函数组件公开实例是 `ComponentPublicInstance` proxy（`$`/`$props`/`$el`/`$parent`/`$root`/`$forceUpdate`/`$nextTick`）：`packages/core/src/runtime/component.ts:117-141`；
- 类组件建议把 **class 实例本身**作为公开实例，并给它安装 `$` 系列访问器：
  ```ts
  Object.defineProperties(ctx, {
    $: { get: () => instance },
    $props: { get: () => instance.props },
    $el: { get: () => instance.vnode.el ?? null },
    $forceUpdate: { value: () => instance.update() },
    $nextTick: { value: nextTick },
  })
  ```
- `app.mount()` 返回 class 实例（typed as `Counter & ComponentPublicInstance`）；组件 ref 指向它；KeepAlive 缓存它；
- 如果用户更希望统一 `ComponentPublicInstance` 包装对象，也可以保留 wrapper，但 `this` 必须是 class 实例（render 内），两者需要明确区分“公开身份”和“渲染上下文”，避免 Proxy 那一堆身份问题；
- DevTools 上报 `instance.type.name`（class name）或 `@Component({ name })`；
- KeepAlive 的 `activated/deactivated` 通过 `instance.activated/deactivated` 注册的 class 方法 wrapper 触发，无需改 KeepAlive。

---

### 3.7 数据 / 注入装饰器（第一版已实现）

| 装饰器 | 元数据 | 运行时接线 |
|---|---|---|
| `@Reactive` | `reactive: Map<key, { shallow? }>` | 构造后摘掉 own 字段，安装 accessor 返回 `reactive(initial)` / `shallowReactive`；setter 重新包装新对象 |
| `@Computed` | `computed: Map<key, getter>` | 在 `instance.scope.run` 内为每实例创建 `computed(() => getter.call(ctx))`；实例 accessor 读 `cache.value`（惰性 + 缓存） |
| `@Watch(source, options?)` | `watch: WatchMeta[]` | `@Setup` 之后注册 `watch(getter, handler)`；source 支持字段名 / 字符串数组 / getter；handler 以 `ctx` 为 `this` 调用，参数 `(value, oldValue, onCleanup)`；随 scope 自动停止 |
| `@Provide` | `provides: { key, property }[]` | `@Setup` 之后执行 `provide(key, ctx[property])`，供后代注入 |
| `@Inject` | `injects: { key, property, default? }[]` | `@Setup` 之前执行 `inject(key, default ?? initializer)`，写入实例字段（快照语义） |

安装顺序（`setupClassComponent`）：

```
new Ctor → 公开实例 → scope:
  @Prop / @Ref / @Reactive / @Inject → @Computed → 生命周期注册
  → @Setup → @Provide / @Watch → render
```

async `@Setup` 时，`@Provide` / `@Watch` 在 Promise resolve 之后安装（`installProvides/installWatches`）。

注意：

- `@Reactive` 只对对象 / 数组生效；原始值字段请用 `@Ref`；
- `@Computed` 必须用于 getter；不要同时声明同名字段；
- `@Inject` 是 setup 期快照；需要响应式注入时 provide `@Reactive` 对象 / ref，并在 render 中读取；
- `@Provide` 当前只支持字段级（方法级提供后续版本）。

---

## 4. 装饰器工具链实测（本机，2026-11）

测试环境：`typescript 6.0.3`、`esbuild 0.25.0 / 0.27.7`（Vite 6.4.3 依赖链）、当前 `tsconfig.base.json`（用户 WIP 已加 `experimentalDecorators: true` / `emitDecoratorMetadata: true`）。

| 场景 | 结果 |
|---|---|
| `tsc --experimentalDecorators --emitDecoratorMetadata --erasableSyntaxOnly` + legacy 属性装饰器 | ✅ 编译通过（`erasableSyntaxOnly` 不阻止装饰器） |
| `tsc` 默认（Stage-3）+ `@dec accessor x = 1` | ✅ 编译通过 |
| `tsc --experimentalDecorators` + `accessor` 装饰器 | ❌ TS1240：按 legacy 3 参数调用，装饰器函数签名不匹配 |
| `esbuild 0.25/0.27` transform legacy 装饰器（`experimentalDecorators: true`） | ✅ 输出 `__decorateClass` helper，可运行 |
| `esbuild 0.25/0.27` transform Stage-3 `@dec accessor x = 1` | ⚠️ **原样输出 `@dec accessor`**，不做降级（浏览器无法执行） |
| `esbuild` 带 `emitDecoratorMetadata: true` | ⚠️ 输出**没有** `Reflect.metadata`；`design:type` 不可用 |
| `tsc --target es2023`（默认 `useDefineForClassFields: true`）+ 原型 accessor + `@Ref count = 1` | ❌ 字段 initializer 创建 own data property，**遮蔽原型 setter**；实测 `hasOwnProperty('count') === true`，响应式失效 |
| 同上 + `--useDefineForClassFields false` | ✅ 字段初始化走 assignment、命中原型 setter；但全局语义变更，不采用 |
| 渲染器在 `new Ctor()` 后“摘掉 own 字段 + 安装 accessor” | ✅ 不依赖字段语义，推荐方案 A |

### 结论

- **目标 API（§2）使用 `@Ref count = 0`（字段装饰器 + 渲染器安装 accessor）→ 对应 legacy 装饰器。**
- **Babel 保留后，最稳的路径是：Babel（legacy decorators transform）→ 输出可执行 JS；Vite/esbuild 继续负责 bundle/部分降级。** 这样不依赖 esbuild 对装饰器的版本行为，也满足“保留 Babel、只删 L1 wrap”的决策。
- **esbuild 实测结果作为旁证**：legacy 装饰器可直接降级；Stage-3 需要额外 transform；`emitDecoratorMetadata` 在 esbuild 下无效。既然 Babel 保留，不必为了装饰器支持而被迫选 Stage-3。
- **Stage-3 是后续迁移方向，不是本版目标**：需要 `@Ref accessor count = 0`、关闭 `experimentalDecorators`，并确认 Babel 8 对应 decorators 插件版本；与 §2 目标写法不同，本版不采用。
- `emitDecoratorMetadata`：若继续用 Babel 的 legacy 装饰器，Babel 可以配置 metadata；若不用，就不要依赖 `design:type`，元数据用显式参数/静态字段表达。建议移除 `emitDecoratorMetadata` 或仅在纯 tsc 类型检查配置中保留，避免“esbuild 下没有、tsc 下有”的歧义。

---

## 5. 与现有 L1 wrap 的对比

| 维度 | 当前 L1 wrap | 类 + 装饰器 | 显式 `defineComponent`（函数） |
|---|---|---|---|
| 组件边界 | PascalCase 启发式，易误判/漏判 | 显式 class + `@Component`（或 render 方法） | 显式调用，零误判 |
| 编译期产物 | Babel 重写 return + 注入 import | 无组件包装；legacy 装饰器由 esbuild 降级 | 无包装 |
| source map | 改写 return，映射复杂 | 1:1（装饰器降级单独处理） | 1:1 |
| 类型体验 | `defineComponent` 返回 `ComponentTag` | `this` 类型完整；`@Ref` 字段类型自然 | 函数参数类型 |
| 组合/复用 | 函数 + hooks/composable | 继承/mixin/DI；组合较弱 | 函数 + hooks/composable |
| 生命周期 | 函数内注册 | 方法装饰器/元数据 | 函数内注册 |
| 静态分析 | 已可分析，但需猜 JSX/命名 | 显式类/装饰器，边界更清晰；仍受别名影响 | 显式定义，最清晰 |
| 工具链 | Babel（Vite pre） | legacy：esbuild；stage-3：Babel/SWC | 无额外 |
| 私有字段 | 无影响 | accessor 方案无影响；Proxy 方案有坑 | 无影响 |
| 学习成本 | 低（函数） | 装饰器/元数据/顺序 | 低 |
| 迁移成本 | 现状 | 需要重写示例/测试/类型 | 函数组件需加显式包装 |
| 可靠性 | 中（启发式） | 高（显式）但引入装饰器魔法 | 高 |

**判断**：类方案在“显式边界/元数据/静态分析”上更好；在“组合性/学习成本/bundle”上不如函数方案。按 D1–D4，本项目选择**类单一路径**，函数方案的缺点通过类内组合（`useXxx` / 辅助函数 / mixin）缓解，不再保留双模式。

---

## 6. “包装不可靠”的具体清单（对现状的批评是否成立）

成立的部分：

1. PascalCase 判定不是组件语义：`wrap.ts:41-46`；
2. 嵌套 PascalCase helper 会被包装：visitor 遍历所有声明；
3. 内联/对象属性/三元/HOC 里的组件函数不会包装；
4. 改写 return 会影响代码形状、source map、调试堆栈；
5. 自动注入 `defineComponent` import 是隐式副作用；
6. 强制“简写 setup”写法，返回 render 函数会编译期报错：`wrap.ts:103-114`。

不成立/被夸大的部分：

1. 当前 wrap 不是“运行时不可靠”，它是确定性的 AST 转换；问题在启发式与产物形状；
2. 类方案同样有隐式魔法（装饰器执行顺序、元数据合并、this 绑定），不是“零魔法”；
3. 显式 `defineComponent` 即可获得同样可靠性，无需引入类。

**决策**：可靠性目标收敛为 **“组件必须显式类化”**（class + `render` / `@Component`）；`defineComponent` 与函数组件路径删除，不再保留“显式 defineComponent”备选（详见 §0.1）。“显式 defineComponent”作为历史对比项保留在 §8 表中，但不再是实现选项。

---

## 7. 风险清单与缓解

| 风险 | 级别 | 缓解 |
|---|---|---|
| Stage-3 装饰器与目标 API 冲突 | 中 | 本版选 legacy（`@Ref count = 0`）；Stage-3 迁移时改 `accessor` 并关闭 `experimentalDecorators`；Babel 保留可承担两种 transform |
| Proxy + `#private` 运行时崩溃 | 高 | 已决策**不用 Proxy**（D3）；渲染器安装 accessor 不改变 `this`，private 字段正常 |
| 方法/事件处理器 `this` 丢失 | 中 | 推荐箭头函数字段或 `@Bind` 装饰器；render 中显式箭头闭包 |
| 装饰器顺序/继承元数据合并 | 中 | 定义规则 + 单测：子类覆盖、父类 hooks 保留、同名字段覆盖 |
| `emitDecoratorMetadata` 在 esbuild 无效 | 中 | 不依赖 `design:type`；Babel 保留时可在 Babel 侧配置 metadata，或移除该选项 |
| `@Ref` 字段类型 vs 运行时 | 低 | 本版用 accessor 描述符，类型与运行时一致 |
| 类组件组合性弱（无 hooks/composables） | 中 | 类内 setup 可调用 `useXxx` 辅助函数；提供 mixin 机制；文档给组合范式 |
| 删除 L1 与函数组件导致现有测试/示例全部迁移 | 高 | 分阶段：先类运行时与装饰器；再批量迁移 core/runtime-core/compiler 测试、内置组件与示例；最后删 wrap |
| 装饰器语法的 TS 版本/未来弃用 | 中 | legacy 装饰器在 TS 6 仍可用；跟踪 Stage-3；装饰器实现隔离在 `@actview/core/decorators` 或独立包 |
| Babel 8 装饰器插件版本可用性 | 中 | 需验证 Babel 8 对应 decorators 插件（当前未安装 `@babel/plugin-proposal-decorators`）；若 Babel 只做静态分析则不阻塞运行时 |
| `@Prop` 可变性/警告 | 低 | props 只读；setter 警告或禁止 |
| 继承体系过深 | 低 | 限制单层继承；组合优先 |
| 源码静态分析误报（装饰器别名） | 中 | 以运行时元数据为准；静态分析只做增强，失败降级 |

---

## 8. 替代方案对比

| 方案 | 描述 | 优点 | 缺点 |
|---|---|---|---|
| A 现状 L1 wrap | PascalCase 函数自动 `defineComponent` | 现有代码可用、函数式、体积小 | 启发式不可靠、Babel 依赖、return 重写 |
| B 类 + 装饰器（提案） | class + `@Ref`/生命周期装饰器 | 显式边界、元数据、静态分析、OO/DI | 工具链/Proxy/绑定/迁移成本 |
| C 类 + 显式静态元数据（无装饰器） | `static refs/props` + base class 方法 | 零装饰器转换、esbuild 友好、静态分析简单 | DX 略啰嗦；仍需显式类 |
| D 函数 + 显式 `defineComponent` | 函数组件必须显式包装 | 可靠性高、零新概念、保留函数式 | 失去自动包装便利；生命周期仍是函数内注册 |
| E B/C 混合 | 类作为可选风格，函数显式包装 | 覆盖两类用户；逐步迁移 | 运行时/文档/测试矩阵变大 |

**决策（D1–D4）：选择 B（类 + 装饰器）作为唯一组件形态，删除 A（L1 wrap）与 D（defineComponent 函数组件）；C（无装饰器类）作为装饰器工具链故障时的降级备选；E（混合）不再采用。**

---

## 9. 分阶段落地计划（类组件单一路径，按 D1–D4）

> 目标不是长期双模式：最终公开 API 只有类组件；`defineComponent`、函数组件、L1 wrap 全部删除。中间阶段只允许**内部实现**临时保留函数组件（例如内置组件迁移前），不暴露为公开写法。

### Phase 0：运行时 class 基础（先不暴露装饰器）

- `ElementType` / `ComponentProps` 加 `ClassComponent<P>`；`JSX.ElementType` 同步；
- `isClassComponent` + `isComponent`（class / 内置 marker）；`createApp` 接受 class；
- `mountComponent` 增加 class 分支：`createComponentInstance` → `initProps` → `new Ctor(props)` → `ctx` → `@Setup` → `instance.render = () => ctx.render()` → `setupRenderEffect`；
- `ComponentInternalInstance` 增加 `ctx`（class 实例）；
- 公开实例策略：class 实例 + `$`/`$props`/`$el`/`$parent`/`$root`/`$forceUpdate`/`$nextTick` 访问器；
- 用 `static refs/props` 先验证 `this.count` / re-render / mounted；**`new Ctor()` 之后先 `installRefs(ctx)`**（摘 own 字段 + 安装 accessor），再执行 `@Setup` / render；
- 验收：class 组件 mount/update/unmount、props 更新、生命周期顺序、KeepAlive/Suspense/ErrorBoundary 至少各一条用例；覆盖 `useDefineForClassFields: true` 与 `false` 两种编译结果。

### Phase 1：装饰器与元数据（从 `@actview/core` 导出，目标 API §2）

- `@Component`、`@Ref`、`@Reactive`、`@Computed`、`@Watch`、`@Prop`；
- `@Setup`、`@BeforeMount`、`@Mounted`、`@BeforeUpdate`、`@Updated`、`@BeforeUnmount`、`@Unmounted`、`@Activated`、`@Deactivated`、`@ErrorCaptured`；
- 可选 `@Bind`、`@Provide`、`@Inject`（首版可后置）；
- `ComponentMeta`（refs/reactive/computed/watch/hooks/props/setup/render）+ 父类合并 + 校验（render 必须存在、方法必须存在）；
- `@Ref` 装饰器只记录元数据，**渲染器在构造后安装每实例 accessor**（§3.3 方案 A），不引入 Proxy；`@Reactive` 用 accessor 包 `reactive()`；
- **装饰器 transform**：legacy + Babel（保留的 Babel 承担）；tsconfig 维持 `experimentalDecorators: true`；`emitDecoratorMetadata` 不依赖；
- 测试：字段类型/初始值/undefined/数组对象/继承、computed 缓存、watch、生命周期顺序、事件 `this`（箭头/`@Bind`）。

### Phase 2：全面类化 + 删除 `defineComponent`

- 公开 API：从 `@actview/core` / `runtime-core` 删除 `defineComponent`、`ComponentFunction`、`ComponentTag` 函数视图；`ComponentProps` 只从 class 构造器推断；
- `isComponent` 只接受 class + Teleport/Transition 等内置 marker；
- 内置组件迁移：
  - `KeepAlive` 改为 class + 装饰器（include/exclude 取 class name）；
  - `Suspense` 改为 class；`lazy` 返回 class（async `@Setup` 或内部 async 组件类）；
  - `ErrorBoundary` 改为 class（`@ErrorCaptured`）；
  - `Teleport`/`Transition` 仍是 renderer 特判 marker，不需要变成 class；
- `createApp` / `app.mount` 根组件只接受 class；`ComponentPublicInstance` 类型改为 class 实例形态；
- 测试迁移：`packages/core/__tests__`（57 条）、`packages/runtime-core`、`packages/jsx` 中所有 `defineComponent(...)` 组件改为 class；`src/App.tsx` 按 §2 改写；
- 验收：全仓测试/typecheck/build 通过；代码库中 `defineComponent` 引用归零（除了迁移说明/历史文档）。

### Phase 3：删除 L1 wrap 阶段（Babel 保留）

- 删除 `packages/compiler/src/wrap.ts`、`wrap.spec.ts` 与 `compileComponents` 的 wrap 逻辑；
- Vite 配置移除 `actviewCompiler` 的 wrap 步骤；Babel 保留：
  - 如果 Babel 用于 legacy 装饰器降级：保留一个只做装饰器/元数据的 Babel 插件（**不是组件包装**）；
  - 如果 esbuild 直接降级 legacy 装饰器：Babel 可只用于 AST 静态分析；
- `@actview/compiler` 保留为**静态分析/AST 工具**（Babel parser 或 TS AST），不再改写组件定义；
- 更新 `docs/compiler-layers.md`（删除 L1 章节，说明 L2 仍由宿主 automatic runtime 完成）、`vite.config.ts`、`packages/compiler/package.json`；
- changeset：`@actview/core`、`@actview/runtime-core`、`@actview/compiler` breaking/major，附迁移指南。

### Phase 4：静态分析 + 后续

- 组件 manifest（props/refs/computed/watch/lifecycle）供 DevTools/文档/路由/SSR；
- HMR 策略：class 实例状态保留/重建规则；
- Stage-3 装饰器迁移：`accessor` + 关闭 `experimentalDecorators`，Babel 8 decorators 插件版本验证后执行；
- SSR/hydrate、DevTools、错误边界增强。

### 影响面 / 删除清单

| 区域 | 改动 |
|---|---|
| `packages/packages/core/src/runtime/component.ts` | 删除 `defineComponent`/`ComponentFunction`/`ComponentTag` 函数视图；保留标记常量；新增 class 类型 |
| `packages/packages/core/src/runtime/element.ts` | `ElementType` 增 class；删 `ComponentFunction`；`ComponentProps` 改 class 推断 |
| `packages/core/src/runtime/component.ts` | 新增 class 实例化 / 元数据消费 / `ctx` |
| `packages/core/src/runtime/patch/index.ts` | class 分支；KeepAlive/Suspense/DevTools 按 class 适配 |
| `packages/core/src/{keepAlive,suspense,errorBoundary}.ts` | 改为 class 组件 |
| `packages/core/src/index.ts` | 删除 `defineComponent` 导出；导出装饰器与 `ActViewComponent` |
| `packages/compiler/src/{wrap.ts,index.ts,vite.ts}` | 删除 wrap；保留可选静态分析/装饰器 transform |
| `vite.config.ts` | 移除 wrap 插件注册（若 Babel 装饰器 transform 仍需要则替换为 decorators 插件） |
| 测试 | core/runtime-core/jsx 全部迁移；compiler wrap tests 删除/重写为分析测试 |
| 文档/示例 | `src/App.tsx`、`docs/compiler-layers.md`、`docs/types-architecture.md`、`docs/renderer-design.md`、changeset |

### 验收清单

- 全仓只有类组件：`rg "defineComponent" packages src` 仅命中历史文档/迁移说明；
- class 组件：挂载/更新/卸载/DOM 复用；`this.count++` 只重跑自身 render；
- 生命周期顺序符合现有约定；`@Ref` 初始值/undefined/数组对象/继承正确；
- 事件方法 `this` 正确（箭头/`@Bind`）；`#private` 字段可用；
- KeepAlive 切换保留 class 实例；Suspense/lazy/ErrorBoundary 按 class 工作；
- JSX `<Counter/>` props 检查；`ComponentProps<typeof Counter>` 正确；
- `pnpm test` / `pnpm typecheck` / `pnpm build` 全绿；Vite 构建不再执行 L1 wrap；
- Babel 仍可被使用（装饰器 transform 或静态分析），但构建链中不再有组件包装步骤。

---

## 10. 最小原型代码（仅设计示意，未落库）

```ts
// packages/core/src/class-component.ts（示意）
export interface ClassComponentCtor<P = any> {
  new (props: P): { render(): Element | null }
  __actview_component_meta__?: ComponentMeta
}

export function isClassComponent(t: unknown): t is ClassComponentCtor {
  return (
    typeof t === 'function' &&
    !!(t as any).prototype &&
    typeof (t as any).prototype.render === 'function'
  )
}

export function runClassComponent(instance: ComponentInternalInstance): void {
  const Ctor = instance.type as unknown as ClassComponentCtor
  const meta = Ctor.__actview_component_meta__ ?? createEmptyMeta()
  const ctx = new Ctor(instance.props) as ClassInstance

  instance.ctx = ctx
  installPublicInstance(ctx, instance)
  installRefs(ctx, meta) // 关键：摘掉 ES2022 own field 遮蔽，再装 accessor

  const prev = setCurrentInstance(instance)
  try {
    instance.scope.run(() => {
      pauseTracking()
      try {
        // installRefs 已在上面完成：去 own 字段 + 安装每实例 accessor
        initClassComputed(ctx, meta)
        initClassWatchers(ctx, instance, meta)
        if (meta.setup) invokeMaybeAsync((ctx as any)[meta.setup], ctx)
        registerClassHooks(instance, ctx, meta)
      } finally {
        resetTracking()
      }
    })
  } finally {
    setCurrentInstance(prev)
  }

  instance.render = () => ctx.render()
}
```

> 真实的 `mountComponent` 还要处理：props 初始化顺序、`installRefs`、async setup 与 Suspense、错误处理、KeepAlive 激活、DevTools、ref 设置、公共实例类型等；render effect / scheduler / lifecycle 数组可以复用现有实现，但函数组件路径会被删除，只保留 class 分支。

---

## 11. 建议（最终，按 D1–D4）

1. **按 Phase 0 → 1 先做运行时/装饰器 Spike**：class 组件 + accessor `@Ref` + 生命周期装饰器，先在 Vite + 保留的 Babel 链路下跑通“挂载/更新/卸载/KeepAlive/事件”10~20 条测试。
2. **`@Ref` 固定用“装饰器元数据 + 渲染器安装 accessor”实现，不用实例 Proxy**；Proxy 方案仅作为历史备选，不再进入实现。
3. **不保留函数组件/`defineComponent`**：Phase 2 一次性迁移公开 API、内置组件、测试与示例；不存在“显式 defineComponent 过渡态”。
4. **删除 L1 wrap 放在最后**：先类化 → 迁移全部测试/内置组件/示例 → 删除 `wrap.ts` 与 Vite wrap 步骤 → 更新文档/changeset。**Babel 保留**：用于装饰器降级或 AST 静态分析，不再做组件包装。
5. **装饰器标准按目标 API 选 legacy**（`experimentalDecorators`，`@Ref count = 0`）；Stage-3 作为后续迁移（需 `accessor` + 关闭 `experimentalDecorators` + 验证 Babel 8 插件）。
6. 静态分析作为**增强**（Babel/TS AST manifest），以运行时元数据为准；不要把它作为删除 L1 的唯一依据。

---

## 12. 决策状态与剩余问题

已拍板（2026-11-12）：

| 问题 | 决策 |
|---|---|
| 装饰器标准 | legacy（`experimentalDecorators`），Babel 保留；Stage-3 后续 |
| 函数组件去留 | 全部迁移为类，删除 `defineComponent` |
| `this` 语义 | raw class 实例 + 渲染器安装 accessor，不用 Proxy |
| 目标 API | §2 的 `Counter` 形态，装饰器从 `@actview/core` 导出 |

仍需在实现前确认的细节：

1. **Babel 的具体职责**：Babel 只做装饰器降级，还是同时做 AST 静态分析/代码生成？这决定是否需要新增 Babel decorators 插件与版本验证。
2. **`@Prop`/`@Provide`/`@Inject` 的首版范围**：先只支持 `@Prop` + `@Ref`，还是一步到位支持 provide/inject 装饰器？
3. **`@Component` 是否必需**：必须显式装饰器，还是 class 只要有 `render` 即识别？（建议必需，便于静态分析与错误提示。）
4. **静态分析产出形态**：只输出 DevTools/文档 manifest，还是生成构建期代码（默认值、路由、SSR 数据）？
5. **HMR/SSR 优先级**：类实例的 HMR 状态保留、SSR 序列化是否首版就要？
6. **版本策略**：删除 `defineComponent`/函数组件是 breaking change，changeset 用 major 还是 major+迁移指南分阶段发布？

---

## 13. 第一版（v0.1）范围（2026-11-12 确认）

> 先把“目标形态 + 响应式渲染”做通，不铺开周边能力。

### 当前进度（2026-11-12，第一版完成）

- ✅ 类组件运行时：`@Component` 标记、`isClassComponent`、`setupClassComponent`、`installRefs / installProps`、class 公开实例、生命周期装饰器注册；
- ✅ 目标 API 子集：`@Component`（强制）、`@Prop`、`@Ref`、`@Setup` / `@BeforeMount` / `@Mounted` / `@BeforeUpdate` / `@Updated` / `@BeforeUnmount` / `@Unmounted` / `@Activated` / `@Deactivated`；
- ✅ 内置组件 KeepAlive / Suspense / ErrorBoundary / lazy 已迁移为 `@Component` 类；
- ✅ 删除 `defineComponent`、函数组件路径、`ComponentFunction` / `ComponentTag` / `SetupFunction`；`isComponent` 只认类组件标记；
- ✅ 删除 L1 wrap（`packages/compiler/src/{wrap,vite}.ts` 与 Vite 插件注册）；compiler 包保留占位，Babel 依赖保留；
- ✅ `src/App.tsx` 迁移为目标类组件示例；`src/main.ts` 使用 `createApp(App)`；
- ✅ `@Reactive` / `@Computed` / `@Watch` / `@Provide` / `@Inject` 已实现：
  - `@Reactive`：对象 / 数组字段安装 reactive（或 shallowReactive）代理；
  - `@Computed`：getter 按实例创建 computed（惰性 + 缓存）；
  - `@Watch`：方法装饰器，支持字段名 / 字段名数组 / getter、`immediate/deep` 选项，随 scope 自动停止；
  - `@Provide` / `@Inject`：字段级注入，`@Inject(key, default?)` 支持默认值；
- ✅ 验证：`pnpm typecheck` / `pnpm test`（core 64 条）/ `pnpm build` / `pnpm build:packages` 全绿。

### 本版未做（后续）

- 静态分析 / manifest / 代码生成；
- HMR / SSR / hydrate；
- 版本发布策略（changeset）与 Stage-3 装饰器迁移；
- `@Bind`、`@Provide` 方法级提供等增强。

### 做

- **类组件运行时**：class 构造函数 + `render()`；`@Component` 强制；JSX `<Counter/>` 类型；挂载/更新/卸载/生命周期；`this.count` 响应式渲染。
- **装饰器**：只做数据相关 `@Prop` + `@Ref`；生命周期 `@Setup` / `@BeforeMount` / `@Mounted` / `@BeforeUpdate` / `@Updated` / `@BeforeUnmount` / `@Unmounted`（KeepAlive 需要的 `@Activated` / `@Deactivated` 可一并支持）。
- **`ActViewComponent` 基类**与从 `@actview/core` 导出的装饰器（目标 API §2 的子集）。
- **`@Ref` 实现**：装饰器只记录元数据，渲染器 `new Ctor()` 后 `installRefs`（摘 own 字段 + 每实例 accessor），不依赖 `useDefineForClassFields`，不用 Proxy。
- **`@Prop`**：只读访问器映射 `instance.props`；支持默认值（initializer 作为 fallback）；父更新 props 触发重渲染。
- **删除 `defineComponent` / 函数组件 / L1 wrap** 作为第一版收尾目标（先让类路径通过，再迁移内置组件/测试/示例，最后删除）。
- 保留 Babel（职责：装饰器降级 / 后续 AST），不保留 wrap 阶段。

### 不做（本版明确排除）

- `@Reactive` / `@Computed` / `@Watch` / `@Provide` / `@Inject` / `@Bind`（后续版本）；
- 静态分析、代码生成、manifest、构建期优化；
- HMR / SSR / hydrate；
- 版本发布/changeset 策略（先不处理版本）；
- 装饰器 Stage-3 迁移（本版 legacy）。

### 验收

1. `@Component` 类组件在 JSX 中可用，props 类型检查通过；
2. `@Ref count`：`this.count` 是 number，`this.count++` → `await nextTick()` 后 DOM 更新，且只重跑所属组件 render；
3. `@Prop`：父组件更新 props → 子组件重渲染，默认值/缺省值正确；
4. 生命周期顺序：setup → beforeMount → mounted → updated → beforeUnmount → unmounted；
5. 事件/方法 `this` 正确；`#private` 字段可用；
6. 全仓 `pnpm test` / `pnpm typecheck` / `pnpm build` 通过，构建不再执行 L1 wrap；
7. 代码库中 `defineComponent` 仅存在于历史文档（实现/测试/示例清零）。

---

## 附：本文依据的代码位置

- 现有组件标记/判定：`packages/packages/core/src/runtime/component.ts:39-91`
- L1 wrap 启发式：`packages/compiler/src/wrap.ts:20-27, 41-46, 138-186, 242-310, 312-349`
- Vite 插件 `enforce:'pre'`：`packages/compiler/src/vite.ts:40-41`、`vite.config.ts:8-16`
- 渲染器组件挂载：`packages/core/src/runtime/patch/index.ts:783-912`
- setup / public proxy / props：`packages/core/src/runtime/component.ts:54-212`
- 实例字段：`packages/core/src/runtime/instance.ts:75-118`
- JSX 类型：`packages/packages/core/src/runtime/element.ts:32-74`、`packages/jsx/src/jsx.ts:65-81`
- TS 配置：`tsconfig.base.json:24-52`
