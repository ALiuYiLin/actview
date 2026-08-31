import { defineConfig } from 'vitest/config'
import { actviewJsxPlugin } from '@actview/plugin-vite'
import { actviewScopedPlugin } from '@actview/plugin-scoped'

export default defineConfig({
  plugins: [
    // v2 管线：React 语义 JSX 编译（全量接管；node_modules 由 babel-host 硬排除）
    actviewJsxPlugin(),
    ...actviewScopedPlugin(),
  ],
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
