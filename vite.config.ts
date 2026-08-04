import { defineConfig } from 'vitest/config'
import path from 'path'
import { actviewPlugin } from '@actview/plugin'

export default defineConfig({
  plugins: [actviewPlugin()],
  optimizeDeps: {
    // workspace 包走源码 transform（含 Babel 插件），不做 esbuild 预构建
    exclude: ['@actview/router'],
  },
  resolve: {
    alias: {
      '@actview/jsx': path.resolve(__dirname, 'packages/jsx/src'),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['scripts/**/*.test.{ts,tsx}'],
  },
  server: {
    port: 3000,
    strictPort: true,
    open: true,
  },
})
