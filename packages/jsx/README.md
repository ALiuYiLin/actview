# @actview/jsx

**ActView 的 JSX 工厂与类型底座** —— 零依赖的 JSX 运行时与全局类型增强。

`@actview/jsx` 是 monorepo 的最底层包：提供 `jsx`/`jsxs`/`jsxDEV` 等 JSX 工厂函数、`Fragment`、元素类型定义与全局 `JSX.IntrinsicElements` 类型增强。消费方通过 `tsconfig` 的 `jsxImportSource` 接入，编译产物与运行时 VNode 形状由 `Symbol.for('react.element')` 结构契约对接（`@actview/core` 不依赖本包，仅在类型层面结构兼容）。

## 核心功能

- **JSX 工厂**：`jsx` / `jsxs` / `jsxDEV` / `createElement` —— Babel/tsc 编译 JSX 时调用的运行时函数
- **`Fragment`**：多根节点片段（`<Fragment>` / `<>...</>`）
- **元素常量**：`REACT_ELEMENT_TYPE` / `REACT_FRAGMENT_TYPE`（`Symbol.for` 全局注册表，跨包共享）
- **子路径入口**：`@actview/jsx/jsx-runtime`、`@actview/jsx/jsx-dev-runtime`（`jsxImportSource` 的自动运行时）
- **全局类型增强**：`JSX.IntrinsicElements`（`HtmlProps`/`InputProps` 等），消费方 import 本包即全局生效

## 安装

```bash
pnpm add @actview/jsx
```

## 快速开始

`tsconfig.json`：

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@actview/jsx"
  }
}
```

```tsx
import { Fragment } from '@actview/jsx'

export function App() {
  return (
    <Fragment>
      <div class="a">hi</div>
    </Fragment>
  )
}
```

## API

| 导出 | 说明 |
|---|---|
| `jsx(type, props, ...children)` | JSX 工厂（`react-jsx` 运行时） |
| `jsxs(type, props)` | JSX 工厂（多子元素批量） |
| `jsxDEV(type, props)` | 开发态 JSX 工厂 |
| `createElement(type, props, ...children)` | 手动创建元素（`h` 风格） |
| `isValidElement(obj)` | 判断是否为合法元素（含 `$$typeof`） |
| `Fragment` | 片段符号 |
| `REACT_ELEMENT_TYPE` / `REACT_FRAGMENT_TYPE` | 元素类型符号 |
| 类型：`VNode` / `VNodeTypes` / `VNodeKey` / `VNodeChild` / `VNodeChildren` / `ComponentType` / `PropsOf` / `LazyVNode` / `HtmlProps` / `InputProps` / `FormEvent` | 元素、组件与属性类型 |

## 依赖关系

- **运行时依赖**：无（零依赖底座）
- **被依赖方**：`@actview/core`（仅类型契约，结构兼容）、`@actview/router`、`actview` 聚合包

## 开发

```bash
pnpm build   # tsup 打包 dist（多 entry：index / jsx-runtime / jsx-dev-runtime / global）
pnpm test    # 走根目录 vitest（test/** 集成测试）
```

## License

MIT
