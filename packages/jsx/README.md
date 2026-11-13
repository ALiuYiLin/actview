# @actview/jsx

**ActView 的 JSX 作者层** —— 全局 JSX 类型、DOM/SVG 属性类型与 automatic runtime。

只负责「用户写 TSX 时看到的那一层」：编辑器提示、props 检查、事件类型、`JSX.Element` 契约。
渲染器内部类型（`VNode` / 组件实例）不在这里，见 `@actview/core/internal`；DOM 渲染器属于 `@actview/core`。

## 配置

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@actview/jsx"
  }
}
```

## 入口

| 入口 | 内容 |
|---|---|
| `@actview/jsx` | 全局 `JSX` 命名空间 + 公开类型（再导出 core）+ `createElement` / `isValidElement` / `Fragment` |
| `@actview/jsx/jsx-runtime` | `jsx` / `jsxs` / `Fragment`（编译产物入口） |
| `@actview/jsx/jsx-dev-runtime` | development runtime（`jsxDEV`） |

## 使用

```tsx
import type { ClassComponent, ComponentProps, Element } from '@actview/jsx'

type Props = { name: string }

class Hello implements ClassComponent<Props> {
  constructor(_props: Props) {}
  render() {
    return <div class="hello">hello</div> // JSX.Element = 公开 Element
  }
}

// class 构造器作为 JSX 标签；props 检查 / 未知属性拦截 / 事件参数
const ok = <Hello name="x" />
// const bad = <Hello name={123} />              // ✗ name 必须 string
// const extra = <Hello name="x" unknown={1}/>   // ✗ 未知属性

const props: ComponentProps<typeof Hello> = { name: 'x' }
```

公开元素只有 4 个字段（`type` / `key` / `props` / `ref`），渲染器内部字段（`el` / `__v_isVNode` / `component`）不会出现在补全里。

## 开发

```bash
pnpm -C packages/jsx typecheck   # 包含 TSX 类型测试
pnpm -C packages/jsx build       # tsup ESM + d.ts
```

类型分层设计见 [docs/architecture.md](../../docs/architecture.md)。
