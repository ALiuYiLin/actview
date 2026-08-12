# @actview/plugin-vite

**ActView 的 Vite 插件** —— `.tsx` / `.js` 在 esbuild 之前过一遍 Babel 做 `defineComponent` 转换（编译核心见 `@actview/babel-plugin-actview`）。

`actviewPlugin()` 是一个薄壳 Vite 插件：`transform` hook 过滤 `.tsx` / `.js` 文件（剥掉 rolldown-vite 的 `?t=` HMR query），调用 Babel 执行 `defineComponentPlugin` 转换，返回代码与 sourcemap。

## 核心功能

- **编译接入**：`defineComponentPlugin` 的 Vite 宿主壳（编译核心在 `@actview/babel-plugin-actview`）
- **`.tsx` / `.js` 双扩展**：`.js` 覆盖 tsc 降级产物（vitepress 等 dist/client 在 node_modules 下，**不按 node_modules 跳过**）
- **性能**：模块级只创建一次 Babel `ConfigItem`（`createBabelTransform` 内部缓存）

## 安装

```bash
pnpm add -D @actview/plugin-vite
```

## 快速开始

`vite.config.ts`：

```ts
import { defineConfig } from 'vite'
import { actviewPlugin } from '@actview/plugin-vite'
import actviewScopedPlugin from '@actview/plugin-scoped'

export default defineConfig({
  plugins: [actviewPlugin(), ...actviewScopedPlugin()],
})
```

之后 `.tsx` 中的组件函数会被自动转换为 `defineComponent` 产物，直接使用 `@actview/core` 渲染。

## API

| 导出 | 说明 |
|---|---|
| `actviewPlugin()`（默认导出同） | Vite 插件：`{ name: 'actview-transform', enforce: 'pre', transform }` |

## 依赖关系

- `@actview/babel-plugin-actview`（编译核心 + 宿主壳）
- `@babel/core`（^8）
- `peerDependencies`：`vite ^6.0.0 || ^7.0.0 || ^8.0.0`（必需）

## 开发

```bash
pnpm build   # tsup 打包 dist
pnpm test    # 走根目录 vitest（集成测试经 scripts/**）
```

## License

MIT
