# @actview/plugin-vite

**ActView v2 的 Vite 插件** —— `actviewJsxPlugin()` 将 `.tsx` / `.ts` / `.jsx` / `.js` 过 Babel（`@actview/plugin-jsx`）：React 语义 JSX 编译（直出 `createVNode`）+ 自动 `defineComponent` 包装。

## 核心功能

- **React 语义 JSX**：`className` / `htmlFor` / `onChange` 映射、`dangerouslySetInnerHTML`、`v-model` 等指令属性
- **自动组件包装**：`function App() { return () => <JSX/> }` 免手动 `defineComponent`（React 函数组件语义）
- **node_modules 硬排除**：依赖走 esbuild 预构建管线（`@actview/plugin-babel` 宿主壳）
- **性能**：模块级只创建一次 Babel `ConfigItem`

## 安装

```bash
pnpm add -D @actview/plugin-vite
```

## 快速开始

`vite.config.ts`：

```ts
import { defineConfig } from 'vite'
import { actviewJsxPlugin } from '@actview/plugin-vite'

export default defineConfig({
  plugins: [actviewJsxPlugin()],
})
```

配 scoped CSS 时注意顺序——**scoped 插件在前**（先注入 `data-v-*` 属性，JSX 源码形态），JSX 编译在后（保留注入属性）：

```ts
import { defineConfig } from 'vite'
import { actviewJsxPlugin } from '@actview/plugin-vite'
import { actviewScopedPlugin } from '@actview/plugin-scoped'

export default defineConfig({
  plugins: [...actviewScopedPlugin(), actviewJsxPlugin()],
})
```

`tsconfig.json` 配 `jsxImportSource: "actview"`。之后 `.tsx` 中即可用 React 语义写组件，运行时为 vue。

## API

| 导出 | 说明 |
|---|---|
| `actviewJsxPlugin(options?)`（默认导出同） | Vite 插件：`{ name: 'actview-v2-jsx', enforce: 'pre', transform }`；`options.babel` 透传宿主壳排除规则（include/exclude） |

## 依赖关系

- `@actview/plugin-jsx`（React 语义 JSX 编译）
- `@actview/plugin-babel`（babel 宿主壳）
- `peerDependencies`：`vite ^6.0.0 || ^7.0.0 || ^8.0.0`（必需）

## 开发

```bash
pnpm build   # tsup 打包 dist
pnpm test    # 走根目录 vitest（test/v2 集成）
```

## License

MIT
