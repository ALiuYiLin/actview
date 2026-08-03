import { defineConfig } from 'vite'
import path from 'path'
import { actviewPlugin } from '@actview/plugin'

export default defineConfig({
  plugins: [actviewPlugin()],
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
