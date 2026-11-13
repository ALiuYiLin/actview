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
| `@Watch(source, options?)` | 方法监听 | source：字段名 / 字段名数组 / getter；支持 `immediate` / `deep` |
| `@Provide` | 把字段值 provide 给后代 | 字段级；key 默认为字段名，可 `@Provide('alias')` |
| `@Inject(key?, default?)` | setup 期解析注入值 | 快照语义；`@Inject('theme')` / `@Inject('missing', 'fallback')` |

`@Ref` 的实现：装饰器只记录元数据；`mountClassComponent` 在 `new Ctor()` 后摘掉 class field 产生的 own data property，再安装每实例 accessor（闭包持有 `ref`）。因此不依赖 `useDefineForClassFields` 全局配置，也不使用 Proxy。

## 3. 组件内数据层（@Model / @UseModel）

```tsx
@Model
class CounterData {
  @Ref count = 0
  @Computed get double() { return this.count * 2 }

  @Setup setup() {}
  @Mounted mounted() {}
  @Unmounted unmounted() {}

  increment() { this.count++ }
}

@Component({ name: 'Counter' })
class Counter extends ActViewComponent {
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
- 每个组件实例一个 `ComponentScope`，同一 token 单实例；多个 Model 依赖同一 Model 时共享；
- Model 支持 `@Ref/@Reactive/@Computed/@Watch/@Inject/@UseModel` + 全部生命周期装饰器；
- Model `@Setup` 早于 owner 组件 `@Setup`；挂载类 hooks 先于 owner，卸载类 hooks 后于 owner；
- 不支持 `@Prop` / `@Provide`；跨组件共享继续用组件上的 `@Provide/@Inject`；
- 完整设计见 [dependency-injection.md](./dependency-injection.md)。

## 4. 生命周期装饰器

`@Setup`、`@BeforeMount`、`@Mounted`、`@BeforeUpdate`、`@Updated`、`@BeforeUnmount`、`@Unmounted`、`@Activated`、`@Deactivated`。

`@Setup` 在实例创建后、首帧前执行一次；可返回 Promise（async setup，首帧渲染 null，resolve 后渲染）。

## 5. 安装顺序

```text
new Ctor(props)
→ 公开实例（$ / $props / $el / ...）
→ ComponentScope + @UseModel（Model 先初始化）
→ @Prop / @Ref / @Reactive / @Inject
→ @Computed
→ 生命周期注册 + Model hooks 排序
→ @Setup（Model @Setup 已先执行）
→ @Provide / @Watch
→ render
```

async 组件 `@Setup` 时，`@Provide` / `@Watch` 在 Promise resolve 后安装；第一版 Model `@Setup` 要求同步。

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

## 7. 注意事项

- 组件必须由渲染器实例化；手动 `new Counter()` 不会安装 `@Ref` / `@Prop` accessor，也不会创建 Model scope；
- 构造函数内部读到的是普通字段（accessor 尚未安装），初始化请放在 `@Setup`；
- `@Inject` 是 setup 期快照；需要响应式注入时 provide `@Reactive` 对象 / `ref`，并在 render 中读取；
- `@Provide` 当前只支持字段级；方法级提供、`@Bind` 后续再补；
- `@Model` 构造函数必须无参；`@Model` 与 `@Component` 互斥（Model 不实现 `render()`）；
- 装饰器使用 legacy 模式（`experimentalDecorators: true`）；`emitDecoratorMetadata` 在 esbuild 下不会生成 `Reflect.metadata`，不要依赖 `design:type`。
