import { defineConfig } from 'vite'
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
      '@local/jsx-factory': path.resolve(__dirname, 'packages/jsx/src'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    open: true,
  },
})
