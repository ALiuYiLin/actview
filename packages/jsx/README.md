# @actview/jsx

**ActView 的 JSX 作者层** —— 全局 JSX 类型、DOM/SVG 属性类型与 JSX automatic runtime。

只负责「用户写 TSX 时看到的那一层」：编辑器提示、props 检查、事件类型、`JSX.Element` 契约。
渲染器内部类型（`VNode` / 组件实例）不在这里，见 `@actview/runtime-core/internal`；DOM 渲染器属于 `@actview/core`。

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
| `@actview/jsx` | 全局 `JSX` 命名空间 + 公开类型（再导出 runtime-core）+ `createElement` / `isValidElement` / `Fragment` / JSX runtime |
| `@actview/jsx/jsx-runtime` | `jsx` / `jsxs` / `jsxDEV` / `Fragment`（编译产物入口） |
| `@actview/jsx/jsx-dev-runtime` | development runtime（`jsxDEV`） |

## 使用

```tsx
import type { ComponentFunction, Element } from '@actview/jsx'

type Props = { name: string }

function Hello(props: Props) {
  return <div class="hello">{props.name}</div>   // JSX.Element = 公开 Element
}

const component: ComponentFunction<Props> = Hello

// props 检查 / 未知属性拦截 / 事件参数类型由全局 JSX 命名空间提供
const ok = <Hello name="x" />
// const bad = <Hello name={123} />              // ✗ name 必须 string
// const extra = <Hello name="x" unknown={1}/>   // ✗ 未知属性
```

公开元素只有 4 个字段（`type` / `key` / `props` / `ref`），渲染器内部字段（`el` / `__v_isVNode` / `component`）不会出现在补全里。

## 开发

```bash
pnpm typecheck   # tsc -p tsconfig.json（含 TSX 类型测试）
pnpm build       # tsup ESM + d.ts（index / jsx-runtime / jsx-dev-runtime）
```

类型分层设计见 `docs/types-architecture.md`。
