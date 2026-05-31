# Debug 配置说明

## 文件结构

```
.vscode/
├── launch.json        # Debug 启动配置
└── tasks.json         # 预启动任务（pnpm dev）
```

## launch.json

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Debug: pnpm dev",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}",
      "preLaunchTask": "pnpm dev",
      "sourceMapPathOverrides": {
        "/@fs/*": "${workspaceFolder}/*",
        "/*": "${workspaceFolder}/*"
      },
      "pathMapping": {
        "/": "${workspaceFolder}",
        "/src": "${workspaceFolder}/src"
      }
    }
  ]
}
```

| 字段 | 值 | 说明 |
|------|-----|------|
| `type` | `chrome` | 使用 Chrome 浏览器调试 |
| `request` | `launch` | 启动新浏览器实例 |
| `url` | `http://localhost:3000` | Vite 开发服务器地址 |
| `webRoot` | `${workspaceFolder}` | 源码根目录 |
| `preLaunchTask` | `pnpm dev` | 启动前自动运行 Vite |

**sourceMapPathOverrides** — Vite 在 dev 模式下通过 `/@fs/` 前缀暴露源码，这里把 `/@fs/` 和 `/*` 都映射回本地文件路径，断点才能命中。

**pathMapping** — 额外路径映射，确保 `/src/` 路径正确对应。

## tasks.json

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "pnpm dev",
      "type": "shell",
      "command": "pnpm dev",
      "isBackground": true,
      "problemMatcher": {
        "pattern": { "regexp": "^.*$", "file": 1, "location": 2, "message": 3 },
        "background": {
          "beginsPattern": ".*VITE.*",
          "endsPattern": "Local:"
        }
      }
    }
  ]
}
```

| 字段 | 说明 |
|------|------|
| `isBackground: true` | Vite 持续运行在后台，不阻塞调试 |
| `beginsPattern: ".*VITE.*"` | Vite 输出启动日志时标记为"开始" |
| `endsPattern: "Local:"` | Vite 打印 `Local:` 地址时标记为"就绪"，此时打开 Chrome |

## 使用方式

1. 按 `F5`（或 运行 → 启动调试）
2. VS Code 自动在终端执行 `pnpm dev`
3. 等待 Vite 输出 `Local: http://localhost:3000/`
4. Chrome 自动打开 `localhost:3000`
5. 在源码（`.ts` / `.tsx` / `.vue`）中点击行号设断点
6. 页面操作触发断点后暂停，可查看变量、调用栈

## 常见问题

### vite.config.ts 提示找不到 path

`tsconfig.json` 只包含 `src/`，不处理 `vite.config.ts`。需要独立的 `tsconfig.node.json`：

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "isolatedModules": true
  },
  "include": ["vite.config.ts"]
}
```

同时安装 `@types/node`：

```bash
pnpm add -D @types/node
```

VS Code 打开 `vite.config.ts` 时会自动向上查找最近的 `tsconfig*.json`，`tsconfig.node.json` 会被识别。

### Chrome 打开空白页

- 确认 Vite 正常启动 → 手动打开 `http://localhost:3000` 检查
- 检查端口号是否被占用 → `vite.config.ts` 中可修改 `server.port`
- 确认 `preLaunchTask` 的 `endsPattern` 匹配 Vite 的实际输出

### Vite 未启动就打开了 Chrome

- `endsPattern: "Local:"` 是 Vite 的标准输出，如果 Vite 版本变了输出格式，需要调整正则
- 检查终端是否有 pnpm 权限问题
