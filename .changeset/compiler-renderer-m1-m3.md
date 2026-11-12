---
"@actview/core": minor
"@actview/runtime-core": minor
"@actview/compiler": minor
---

ActView 分层编译器与渲染器 M1–M3 落地：

- `@actview/compiler`（新增）：L1 组件包装 Babel 插件（TSX 组件函数 → `defineComponent(setup)`），Vite 宿主；JSX 降级交给宿主 automatic runtime（esbuild/tsc + `jsxImportSource=@actview/jsx`）。
- `@actview/runtime-core`：`defineComponent` 改为给 setup 函数本体打 `__actview_component` 标记并原样返回（不再包 `{ __setup }` 对象），新增 `isComponent`；`SetupFunction` 支持 async setup（返回 `Promise<RenderFunction>`）。
- `@actview/core`：实现 DOM 渲染器 M1–M3——`createApp`/`mount`/`unmount`、组件级 re-render（render effect + 微任务 scheduler）、diff/patch（keyed + LIS）、provide/inject、public instance proxy、完整 `patchProp`（DOM property / SVG / 事件选项）、错误边界（ErrorBoundary / onErrorCaptured）、async setup + Suspense + lazy、Teleport / Transition / KeepAlive、DevTools 钩子。
