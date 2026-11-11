# @actview/runtime-core

**ActView 运行时内核的类型基础** —— 平台无关的公开元素/组件契约 + 渲染器内部类型。

## 入口

| 入口 | 可见性 | 内容 |
|---|---|---|
| `@actview/runtime-core` | 公开 | `Element` / `ElementType` / `ComponentFunction` / `ComponentTag` / `ComponentProps` / `ElementChild(ren)` / `RenderFunction` / `SetupContext`；`createElement` / `isValidElement` / `Fragment` / `defineComponent` / `isComponent` |
| `@actview/runtime-core/internal` | 内部（workspace 内使用，不随包发布） | `VNode` / `VNodeTypes` / `VNodeChild(ren)` / `createVNode` / `isVNode` / `Component` / `ComponentInternalInstance` / `SetupFunction` / `defineComponent` / `isComponent` |

依赖方向：`@actview/jsx → @actview/runtime-core`（DOM 渲染器 `@actview/core` 后续同样单向依赖本包）；本包不依赖上层包（平台无关）。

## 类型关系

```ts
// 公开元素契约：只承诺 4 个稳定字段（无 VNode 内部字段）
interface Element {
  readonly type: ElementType
  readonly key: string | number | null
  readonly props: Record<string, any> | null
  readonly ref: unknown
}

// 内部 VNode：Element 的子类型（渲染器字段不进入公开契约）
interface VNode<Type> extends Element {
  readonly __v_isVNode: true
  el: unknown | null
  component: ComponentInternalInstance | null
  children?: VNodeChildren
}

// 源码组件（用户书写）
type ComponentFunction<P> = (props: P) => Element | null

// 运行时组件 = setup 函数本体 + 标记（defineComponent 写入；内部类型）
type Component<P> = SetupFunction<P> & {
  readonly __actview_component: true
  readonly name?: string
}

// 公开层只给「JSX 标签视图」：调用签名仅用于 JSX 检查，运行时并不额外包装
type ComponentTag<P> = Component<P> & ((props: P) => any)
```

`defineComponent(setup, name?)` 返回**同一个 setup 函数对象**（用
`Object.defineProperty` 写入 `__actview_component: true` 与函数 `name`，幂等），
`isComponent(value)` 以 `typeof value === 'function' && value.__actview_component === true`
判定组件函数。公开入口不导出 `Component` 类型（内部边界）。

## 使用

```tsx
// 公开层（用户 / 公开 API）
import { defineComponent, isComponent } from '@actview/runtime-core'
import type { ComponentFunction, Element } from '@actview/runtime-core'

function App() {
  return <div>hello</div>
}
const fn: ComponentFunction = App

const Counter = defineComponent((props: { start: number }) => {
  return () => <span>{props.start}</span>
}, 'Counter')
isComponent(Counter) // true（同一个 setup 函数 + __actview_component 标记）

// 内部层（渲染器 / compiler / 测试）
import { createVNode, isVNode } from '@actview/runtime-core/internal'
const vnode = createVNode('div', { class: 'x' })
```

## 开发

```bash
pnpm typecheck   # tsc -p tsconfig.json（含 type-tests）
pnpm build       # tsup ESM + d.ts
```

类型分层设计与不变量见 `docs/types-architecture.md`。
