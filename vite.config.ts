import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  // esbuild: {
  //   jsx: 'automatic',
  //   jsxImportSource: '@local/jsx-factory',
  // },
  resolve: {
    alias: {
      '@local/jsx-factory': path.resolve(__dirname, 'packages/jsx/src'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    open: true
  }
})
