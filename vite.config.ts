import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => ({
  // @actview 源码里的编译期常量（Vue 源码约定）：
  // dev/test 为 true、生产构建为 false（esbuild define 只接受字面量，这里直接写 true/false）。
  define: {
    __DEV__: JSON.stringify(mode !== 'production'),
  },
  optimizeDeps: {
    // workspace 包直接消费源码（走 Vite transform，__DEV__ define 才能生效）
    exclude: ['@actview/reactivity', '@actview/shared'],
  },
  resolve: {
    alias: {
      // 直接映射到源码，dev / build 均免预构建（pnpm workspace link 存在时也一致）
      '@actview/reactivity': fileURLToPath(
        new URL('./packages/reactivity/src/index.ts', import.meta.url),
      ),
      '@actview/shared': fileURLToPath(
        new URL('./packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['packages/reactivity/__tests__/**/*.spec.ts'],
    setupFiles: ['./packages/reactivity/__tests__/setup.ts'],
    passWithNoTests: true,
  },
  server: {
    port: 3000,
    strictPort: true,
    open: true,
  },
}))
