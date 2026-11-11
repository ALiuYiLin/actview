# @actview/core

**ActView DOM 运行时公开层**（占位）—— 规划承载：DOM 渲染器（`createApp` / `patch` / 生命周期 / 内置组件）。

当前阶段只落地了类型基础与 JSX 作者层：

- JSX 类型 / JSX runtime → [`@actview/jsx`](../jsx/README.md)
- 公开元素/组件契约、内部 VNode 类型 → [`@actview/runtime-core`](../runtime-core/README.md)
- 响应式系统 → [`@actview/reactivity`](../reactivity/README.md)

渲染器实现接入后，本包从 `@actview/runtime-core` 取内部类型（`/internal` 入口），对外只暴露公开 API。

## 开发

```bash
pnpm typecheck   # tsc -p tsconfig.json
pnpm build       # tsup ESM + d.ts
```

类型分层设计见 `docs/types-architecture.md`。
