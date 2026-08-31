import { defineConfig } from 'vitest/config'
import { actviewJsxPlugin } from '@actview/plugin-vite'
import { actviewScopedPlugin } from '@actview/plugin-scoped'

export default defineConfig({
  plugins: [
    // ⚠️ 顺序：scoped 先注入 data-v-* 属性（JSX 源码形态），
    // actviewJsxPlugin 后转 createVNode（保留注入的属性）
    ...actviewScopedPlugin(),
    actviewJsxPlugin(),
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
