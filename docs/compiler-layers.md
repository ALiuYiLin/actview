# ActView 编译链（第一版：L1 wrap 已删除）

> 历史文档标题曾为「L1 组件包装 / L2 宿主 automatic runtime」。第一版类组件重构后，
> **L1 组件包装阶段已删除**；当前只剩 JSX 降级（由宿主工具链完成）。

## 1. 当前编译链

```
应用 TSX 源码
  → Vite / esbuild：
      - TypeScript 类型剥离
      - legacy decorators 降级（tsconfig: experimentalDecorators）
      - JSX automatic runtime 降级
  → 浏览器运行时可执行 JS
  → @actview/core 的 createApp / 类组件运行时
```

- **组件不需要编译期包装**：`@Component` 类由运行时直接识别；
- **JSX 降级仍由宿主完成**：`tsconfig.base.json` 的 `"jsx": "react-jsx"` +
  `"jsxImportSource": "@actview/jsx"`，esbuild / tsc 调用 `@actview/jsx` 的
  `jsx` / `jsxs` / `Fragment`；
- **装饰器降级由 esbuild 的 legacy decorators 支持**（Babel 依赖保留，可作为
  替代降级/后续分析通道）；
- 不再有 `actviewCompiler` Vite 插件；`vite.config.ts` 的 `plugins` 为空。

## 2. `@actview/compiler` 包现状

- `src/wrap.ts` / `src/vite.ts` / `__tests__` 已删除；
- 包入口 `src/index.ts` 为空导出，仅保留包与 `@babel/core` 依赖，作为后续
  装饰器 transform / 静态分析占位；
- 不再导出 `wrapComponentsPlugin` / `compileComponents` / `actviewCompiler`；
- 如后续做组件 manifest，可在此包内用 TS/Babel AST 读取 `@Component` 类，
  不修改组件代码。

## 3. 为什么删除 L1

1. 组件边界由 `@Component` 显式声明，不再依赖 PascalCase 启发式；
2. 不需要 AST 改写 `return () => JSX`，source map / 堆栈保持 1:1；
3. 不需要自动注入 `defineComponent` import；
4. 类组件 + `@Ref` / `@Prop` 的状态、生命周期元数据来自装饰器，编译期无需参与；
5. Vite 管线少一层 `enforce:'pre'` Babel 转换。

## 4. 验证

```bash
pnpm build        # tsc -b + vite build（含类组件 App）
pnpm typecheck
pnpm test
```

当前 app 构建产物已包含类组件 + 装饰器（无 L1 wrap）。
