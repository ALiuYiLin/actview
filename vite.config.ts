import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: '@local/jsx-factory',
  },
  resolve: {
    alias: {
      '@local/jsx-factory': path.resolve(__dirname, 'packages/jsx/src'),
    },
  },
})
