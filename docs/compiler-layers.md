# ActView 编译链（第一版：无 compiler 包）

> `@actview/compiler` 与 L1 wrap 已删除；组件由运行时直接识别 `@Component` 类。

## 当前链路

```
TSX 源码
  → Vite / esbuild：
      - TypeScript 类型剥离
      - legacy decorators 降级（tsconfig experimentalDecorators）
      - JSX automatic runtime（jsxImportSource = @actview/jsx）
  → 浏览器可执行 JS
  → @actview/core 的 createApp / 类组件运行时
```

- 不存在组件包装阶段；不需要 Babel 转换；
- JSX 降级由宿主 automatic runtime 完成（`@actview/jsx` 提供 `jsx` / `jsxs` / `Fragment`）；
- 装饰器由 esbuild legacy decorators 降级；Babel 仅作为根 devDependency 保留（后续如需装饰器/静态分析可选接入）；
- `vite.config.ts` 无自定义 compiler 插件。

## 验证

```bash
pnpm build   # tsc -b + vite build
pnpm test
pnpm typecheck
```

## 后续

若需要组件 manifest / 静态分析，可新增独立工具包（TS/Babel AST），不修改组件定义。
