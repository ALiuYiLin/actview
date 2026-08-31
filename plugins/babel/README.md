# @actview/plugin-babel

**共享 Babel 宿主壳** —— 统一 `transformSync` 调用参数与排除规则，供 `@actview/plugin-vite` 与 `@actview/plugin-scoped` 复用。

（v1 的 `defineComponentPlugin` / `solidPlugin` 已随 ActView v2 移除——v2 的 JSX 编译由 `@actview/plugin-jsx` 承担。）

## 核心功能

- **统一参数**：`parserOpts(jsx+typescript)` / `retainLines` / `sourceMaps` / `babelrc:false` / `configFile:false`
- **排除规则**：node_modules 硬排除（include 不可覆盖）/ include 白名单 / exclude 黑名单
- **性能**：`createBabelTransform` 模块级创建一次 ConfigItem（Babel 8 同步），跨多次 `transformSync` 复用

## 安装

```bash
pnpm add -D @actview/plugin-babel
```

## API

| 导出 | 说明 |
|---|---|
| `createBabelTransform(plugin, options?)` | 宿主壳工厂：模块级创建一次 ConfigItem，返回 `(code, filename) => { code, map } \| null` |
| `createBabelItem(plugin)` | 把插件工厂预编译为 ConfigItem（Babel 8 同步） |
| `transformWithBabel(code, filename, pluginItem, options?)` | 统一参数的 `transformSync` |
| `isExcludedTransform(filename, options?)` | 排除判定：node_modules 硬排除 / 未命中 include / 命中 exclude |
| 类型：`BabelPlugin` / `BabelHostResult` / `BabelTransformOptions` | 宿主壳类型 |

## 排除规则（node_modules 硬排除）

宿主壳**硬排除 node_modules 下的文件**（返回 `null` 不转换）：依赖是第三方代码，属依赖管线（esbuild 预构建），不是源码管线。`BabelTransformOptions`：

```ts
{
  include?: Array<string | RegExp>,  // 白名单：命中任一才转换（默认不过滤；node_modules 硬排除优先）
  exclude?: Array<string | RegExp>,  // 黑名单：命中任一即跳过（优先于 include）
}
```

**源码分发库包（node_modules 下）需要现场编译时**，在宿主构建配置里做**路径转换**，让文件解析路径脱离 node_modules 段：

```ts
// vite.config.ts
resolve: {
  alias: { 'my-lib': 'node_modules/my-lib/src' }, // 路径不再含 node_modules 段 → 正常转换
},
optimizeDeps: { exclude: ['my-lib'] },
```

## 依赖关系

- `@babel/core`（^8）
- 被依赖方：`@actview/plugin-vite`、`@actview/plugin-scoped`（复用宿主壳）

## 开发

```bash
pnpm build   # tsup 打包 dist
pnpm test    # vitest（test/babel-host.test.ts：排除规则/宿主壳行为）
```

## License

MIT
