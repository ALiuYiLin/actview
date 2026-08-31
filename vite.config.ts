import { defineConfig } from 'vitest/config'
import path from 'path'
import { actviewJsxPlugin, actviewPlugin } from '@actview/plugin-vite'
import { actviewScopedPlugin } from '@actview/plugin-scoped'

const SRC_DIR = path.resolve(__dirname, 'src').replace(/\\/g, '/')
const V2_TEST_DIR = path.resolve(__dirname, 'test/v2').replace(/\\/g, '/')

export default defineConfig({
  plugins: [
    // v2 管线：React 语义 JSX 编译（仓库根 src/ demo 区 + test/v2）
    // ⚠️ include/exclude 规则需正斜杠（babel-host 会把 filename 归一为正斜杠）；
    // 且用绝对路径——'/src/' 会误匹配 packages/*/src（v1 包源码）
    actviewJsxPlugin({
      babel: { include: [SRC_DIR, V2_TEST_DIR] },
    }),
    // v1 管线：仅 v1 测试（test/ 下非 v2 文件）；src/ 与 test/v2/ 已由 v2 接管
    actviewPlugin({
      babel: { exclude: [SRC_DIR, V2_TEST_DIR] },
    }),
    ...actviewScopedPlugin(),
  ],
  resolve: {
    alias: {
      // workspace 包 exports 已指向 src（dev 免构建）；jsx 子路径别名是历史保留
      '@actview/jsx': path.resolve(__dirname, 'packages/jsx/src'),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.{ts,tsx}', 'plugins/**/test/*.test.ts'],
  },
  server: {
    port: 3000,
    strictPort: true,
    open: true,
  },
})
