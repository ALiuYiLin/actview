import { defineConfig } from 'vitest/config'
import { actviewJsxPlugin } from '@actview/plugin-vite'
import { actviewScopedPlugin } from '@actview/plugin-scoped'

export default defineConfig({
  // Vue 编译期 feature flags（esm-bundler build 需要全局注入，否则：
  // 1) 运行时 warnOnce 提示；2) 生产包无法摇树裁剪 Options API / devtools / hydration 细节）
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
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
