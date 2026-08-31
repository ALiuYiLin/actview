import { defineConfig } from 'vitest/config'
import path from 'path'
import { actviewPlugin } from '@actview/plugin-vite'
import { actviewScopedPlugin } from '@actview/plugin-scoped'
import { v2JsxPlugin } from './test/v2/plugin-v2-jsx'

export default defineConfig({
  plugins: [
    v2JsxPlugin(),
    // v1 管线排除 test/v2/（v2 的 JSX 由 @actview/plugin-jsx 编译，组件是 vue 组件，
    // 不能被 v1 的 defineComponentPlugin 包装）
    actviewPlugin({ babel: { exclude: ['/test/v2/'] } }),
    ...actviewScopedPlugin(),
  ],
  optimizeDeps: {
    // workspace 包走源码 transform（含 Babel 插件），不做 esbuild 预构建
    exclude: ['@actview/router'],
  },
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
