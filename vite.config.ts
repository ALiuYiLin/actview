import { defineConfig } from 'vitest/config'
import path from 'path'
import { actviewJsxPlugin, actviewPlugin } from '@actview/plugin-vite'
import { actviewScopedPlugin } from '@actview/plugin-scoped'

export default defineConfig({
  plugins: [
    // v2 管线：React 语义 JSX 编译（当前仅 test/v2；demo 区迁移后接管全部）
    actviewJsxPlugin({ babel: { include: ['/test/v2/'] } }),
    // v1 管线排除 test/v2/（v2 的 JSX 由 @actview/plugin-jsx 编译，组件是 vue 组件，
    // 不能被 v1 的 defineComponentPlugin 包装）
    actviewPlugin({ babel: { exclude: ['/test/v2/'] } }),
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
