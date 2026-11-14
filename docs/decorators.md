# 类组件与装饰器

> 当前组件模型：唯一形态是 `@Component` 类。`defineComponent` / 函数组件已删除。
> 架构与包结构见 [architecture.md](./architecture.md)。

## 1. 基础

```tsx
import {
  ActViewComponent,
  Component,
  Model,
  Prop,
  Ref,
  Reactive,
  Computed,
  Watch,
  Provide,
  Inject,
  Setup,
  BeforeMount,
  Mounted,
  BeforeUpdate,
  Updated,
  BeforeUnmount,
  Unmounted,
  Activated,
  Deactivated,
  UseModel,
} from 'actview'

@Component({ name: 'Counter' })
export class Counter extends ActViewComponent<{ initial?: number }> {
  @Prop initial = 1
  @Ref count = 0
  @Reactive user = { name: 'Ada' }
  @Computed get double() { return this.count * 2 }
  @Watch('count') onCount(value: number, oldValue: number) {}

  @Setup setup() { this.count = this.initial }
  @Mounted mounted() {}
  @Unmounted unmounted() {}

  render() {
    return <button onClick={() => this.count++}>{this.count}/{this.double}</button>
  }
}
```

- `@Component` 必须显式使用；缺失时不会被识别为组件；
- 类必须实现 `render()`；
- 需要 props 时继承 `ActViewComponent<Props>`（或声明 constructor(props)）。

## 2. 数据装饰器

| 装饰器 | 语义 | 说明 |
|---|---|---|
| `@Prop` | 字段映射 `instance.props[key]` | initializer 作为缺省值；父更新 props 触发 render |
| `@Ref` | 字段等价于 `ref` 的 `.value` | `this.count: number`；`this.count++` 触发所属组件 re-render |
| `@Reactive` | 对象 / 数组字段变成 `reactive`（或 `shallowReactive`） | 原始值字段请用 `@Ref` |
| `@Computed` | getter → 按实例 `computed` | 惰性求值 + 缓存；必须用于 getter |
| `@Watch(source, options?)` | 方法监听 | source：字段名 / 字段名数组 / 普通 function；支持 `immediate` / `deep` |
| `@Provide` | 把字段值 provide 给后代 | 字段级；key 默认为字段名，可 `@Provide('alias')` |
| `@Inject(key?, default?)` | setup 期解析注入值 | 快照语义；`@Inject('theme')` / `@Inject('missing', 'fallback')` |

`@Ref` 的实现：装饰器只记录元数据；`mountClassComponent` 在 `new Ctor()` 后摘掉 class field 产生的 own data property，再安装每实例 accessor（闭包持有 `ref`）。因此不依赖 `useDefineForClassFields` 全局配置，也不使用 Proxy。

`@Watch` 的函数 source 必须是**普通 function**，安装时以实例作为 `this`；不能使用箭头函数（装饰器参数在类定义阶段求值，箭头函数会捕获错误的 `this`）：

```tsx
// ✅ 推荐：字段 / computed
@Watch('count') onCount(value: number) {}
@Computed get isBig() { return this.count > 3 }
@Watch('isBig') onBig(value: boolean) {}

// ✅ 普通 function
@Watch(function (this: Counter) { return this.count > 3 })
onBig() {}

// ❌ 箭头函数
@Watch(() => this.count > 3) onBig() {}
```

## 3. 组件内数据层（@Model / @UseModel）

```tsx
@Model
class CounterData {
  @Prop initCount!: number
  @Ref count = 0
  @Computed get double() { return this.count * 2 }

  @Setup setup() { this.count = this.initCount }
  @Mounted mounted() {}
  @Unmounted unmounted() {}

  increment() { this.count++ }
}

@Component({ name: 'Counter' })
class Counter extends ActViewComponent {
  @Prop initCount = 1

  @UseModel(CounterData)
  counterData!: CounterData

  render() {
    return <button onClick={() => this.counterData.increment()}>
      {this.counterData.count} / {this.counterData.double}
    </button>
  }
}
```

- 显式 token：`@UseModel(CounterData)`（TS 类型擦除 + esbuild 无 `design:type`）；
- 默认 `ComponentScope` 是 **component**：每个组件实例一份；同一 token + name 单实例；
- `@Scope('inherited')`：最近祖先已有则复用，没有则当前组件创建；
- `@Scope('app')`：每个 AppContext 一份；
- `@Named('x')` / `@UseModel(Token, { name })`：同一 scope / token 多实例；
- Model 支持 `@Ref/@Reactive/@Computed/@Watch/@Inject/@UseModel/@Prop/@Provide` + 生命周期装饰器；
- Model `@Prop` 是组件同名 `@Prop` 的**只读投影**；组件必须声明；Model 不需要时可以不写；
- Model `@Setup` 默认在 owner 组件 `@Setup` 之前；`@Setup('after')` 在其后；
- **生命周期归创建者**：inherited 消费者不重跑 setup / hooks，app scope 跟 app 生命周期；
- 挂载类 hooks 先于 owner，卸载类 hooks 后于 owner（仅 component / inherited 的创建者）；
- Model `@Provide` 写入 owner 注入表，后代可 `@Inject`；跨组件共享值/对象；
- `@Setup` 支持 async（component / inherited 的 pre/after 阶段会等待 Promise）；
- app scope 暂不支持 `@Prop` / `@Provide` / async `@Setup`；
- 完整设计见 [dependency-injection.md](./dependency-injection.md)，使用教程见 [model.md](./model.md)。

## 4. 生命周期装饰器

`@Setup`、`@BeforeMount`、`@Mounted`、`@BeforeUpdate`、`@Updated`、`@BeforeUnmount`、`@Unmounted`、`@Activated`、`@Deactivated`。

`@Setup` 在实例创建后、首帧前执行一次；可返回 Promise（async setup，首帧渲染 null，resolve 后渲染）。
Model 额外支持 `@Setup('pre')` / `@Setup('after')`：以 owner 组件 `@Setup` 为基准，默认 `pre`。

## 5. 安装顺序

```text
new Ctor(props) + initProps
→ 公开实例（$ / $props / $el / ...）
→ 组件 @Prop / @Ref / @Reactive / @Inject / @Computed
→ ComponentScope + @UseModel（构造 Model、@Prop 投影、其它字段）
→ 生命周期注册 + Model hooks 排序
→ Model pre @Setup（+ Model @Provide/@Watch）
→ 组件 @Setup（可 async）
→ Model after @Setup（@Setup('after')）
→ 组件 @Provide / @Watch
→ render
```

async 组件 / Model `@Setup` 时，后续阶段会等待 Promise；期间首帧渲染 null。

## 6. 注入示例

```tsx
@Component({ name: 'ThemeProvider' })
class ThemeProvider extends ActViewComponent {
  @Provide() theme = 'dark'
  render() { return <Child /> }
}

@Component({ name: 'Child' })
class Child extends ActViewComponent {
  @Inject('theme') theme!: string
  @Inject('missing', 'fallback') fallback!: string
  render() { return <span>{this.theme}:{this.fallback}</span> }
}
```

## 7. 组合与组件 ref（不做 slots / defineExpose）

ActView 采用 React 风格组合：**不提供 slot API**，通过 props 传组件构造器、render function 或 `children`。

```tsx
import type { ClassComponent } from 'actview'

@Component({ name: 'Layout' })
class Layout extends ActViewComponent {
  @Prop
  SideBarItem!: ClassComponent<{ active: boolean }>

  @Prop
  active = false

  render() {
    const SideBarItem = this.SideBarItem
    return <SideBarItem active={this.active} />
  }
}
```

- 默认内容：`props.children`；
- 具名区域：多个 prop；
- 作用域内容：render function prop（如 `@Prop renderItem!: (item: Item) => ElementChild`）；
- **不要把 `<SideBar />` 这种 VNode 作为 prop**：ActView VNode 可变，复用会不稳定。

组件 ref 使用显式 callback + 类实例：

```tsx
interface SideBarHandle {
  open(): void
}

@Component({ name: 'SideBar' })
class SideBar extends ActViewComponent implements SideBarHandle {
  open() {}
  render() { return <aside /> }
}

@Component({ name: 'Layout' })
class Layout extends ActViewComponent {
  sideBar: SideBarHandle | null = null

  render() {
    return (
      <SideBar
        ref={(el) => {
          this.sideBar = el as SideBarHandle | null
        }}
      />
    )
  }
}
```

- 不需要 `defineExpose`：ref 拿到的是类实例；
- 用 TypeScript interface 约束公开面，父组件只依赖接口；
- `@Ref` 是组件本地响应式状态，**不会自动绑定子组件**；组件 ref 建议用普通字段（不触发重渲染）；
- ref 在 mount 前 / unmount 后为 `null`，类型应允许 null；
- 真正私有状态用 `#private`；`private` 只是编译期检查。

## 8. 注意事项

- 组件必须由渲染器实例化；手动 `new Counter()` 不会安装 `@Ref` / `@Prop` accessor，也不会创建 Model scope；
- 构造函数内部读到的是普通字段（accessor 尚未安装），初始化请放在 `@Setup`；
- `@Inject` 是 setup 期快照；需要响应式注入时 provide `@Reactive` 对象 / `ref`，并在 render 中读取；
- `@Prop` / Model `@Prop` 都是只读的（由父组件传入）；Model `@Prop` 必须由 owner 组件声明同名 prop；
- `@Provide` 当前只支持字段级；方法级提供、`@Bind` 后续再补；
- `@Model` 构造函数必须无参；`@Model` 与 `@Component` 互斥（Model 不实现 `render()`）；
- 装饰器使用 legacy 模式（`experimentalDecorators: true`）；`emitDecoratorMetadata` 在 esbuild 下不会生成 `Reflect.metadata`，不要依赖 `design:type`。
