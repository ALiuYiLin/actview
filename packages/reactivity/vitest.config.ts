import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // 固定 root 为包目录：从仓库根 `npx vitest --config packages/reactivity/vitest.config.ts` 也能正确匹配 __tests__
  root: fileURLToPath(new URL('.', import.meta.url)),
  define: {
    // Vue 源码里的编译期常量：测试按 dev 构建语义运行（会走 warn 分支）
    __DEV__: 'true',
  },
  resolve: {
    alias: {
      // workspace 内免 install 解析 @actview/shared
      '@actview/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['__tests__/**/*.spec.ts'],
    setupFiles: ['./__tests__/setup.ts'],
  },
})
