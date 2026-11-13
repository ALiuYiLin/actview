# 构建与开发链

> 当前没有 `@actview/compiler` 包；不存在 L1 组件包装。

## 1. 源码 → 运行

```text
TSX 源码
  → Vite / esbuild：
      - TypeScript 类型剥离
      - legacy decorators 降级（tsconfig experimentalDecorators）
      - JSX automatic runtime（jsxImportSource = @actview/jsx）
  → 浏览器可执行 JS
  → @actview/core 的 createApp / 类组件运行时
```

- 组件由 `@Component` 类直接表达，编译期不需要包装函数；
- JSX 由宿主 automatic runtime 调用 `@actview/jsx` 的 `jsx` / `jsxs` / `Fragment`；
- 装饰器由 esbuild legacy decorators 降级；根目录保留 `@babel/core` devDependency，仅供后续可选工具使用。

## 2. Workspace

```text
packages/
  actview/          用户聚合入口
  core/             类型 + 渲染器 + 装饰器 + 内置组件
  jsx/              JSX 作者层
  reactivity/       响应式系统（内部）
  shared/           内部工具
playground/
  actview/          私有示例应用（不发布）
```

- `pnpm-workspace.yaml` 包含 `packages/*` 与 `playground/*`；
- 包之间通过 workspace 依赖 + TypeScript project references 解析；
- 根 `tsconfig.json` 只负责库包 references，playground 有自己的 `tsconfig.json`。

## 3. TypeScript 配置

- 根 `tsconfig.base.json`：公共选项（ES2023、strict 默认关闭、`experimentalDecorators`）；
- 各包 `tsconfig.json`：composite 构建，`emitDeclarationOnly` → `dist-types`（gitignore）；
- 各包 `tsconfig.test.json`：测试 / type-tests 的 noEmit 检查；
- 只有使用 TSX 的项目显式设置 `jsx: react-jsx` + `jsxImportSource: @actview/jsx`（根 playground、core tests、jsx type-tests）；
- `reactivity` 构建配置保持 ES2016 + `erasableSyntaxOnly: false`（派生自 Vue 源码的编译前提）。

## 4. 命令

```bash
pnpm dev            # playground/actview（Vite）
pnpm build          # playground: tsc -b + vite build
pnpm preview        # playground 预览
pnpm typecheck      # 5 包 + playground
pnpm test           # vitest（reactivity + core）
pnpm build:packages # tsup 各包（含 d.ts）
```

## 5. playground

`playground/actview` 是私有包（`private: true`）：

- 自己的 `index.html` / `src` / `public`；
- 自己的 `vite.config.ts`：`@actview/jsx` automatic runtime、workspace alias、`__DEV__` define；
- `tsconfig.json` 引用各库包，app 只从用户入口 `actview` 导入。

## 6. 后续

- 若需要组件 manifest / 静态分析，可新增独立工具包（TS/Babel AST），不修改组件定义；
- SSR / HMR 功能尚未实现。
