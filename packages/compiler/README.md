# @actview/compiler

第一版类组件重构后，**L1 组件包装已删除**：组件由运行时直接识别
`@Component` 类，不需要编译期把函数包成 `defineComponent(setup)`。

当前包状态：

- `src/wrap.ts` / `src/vite.ts` / `__tests__` 已删除；
- 入口 `src/index.ts` 为空导出，保留包与 `@babel/core` 依赖，作为后续
  装饰器 transform / 组件静态分析（manifest）的占位；
- 不再导出 `wrapComponentsPlugin` / `compileComponents` / `actviewCompiler`。

JSX 降级仍由宿主 automatic runtime 完成（Vite/esbuild/tsc 读取
`tsconfig` 的 `jsx: react-jsx` + `jsxImportSource: @actview/jsx`）。
详见 `docs/compiler-layers.md` 与 `docs/class-component-design.md`。
