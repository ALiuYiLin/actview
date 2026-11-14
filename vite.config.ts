import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const src = (rel: string) => fileURLToPath(new URL(rel, import.meta.url))

export default defineConfig(({ mode }) => ({
  // 第一版类组件：L1 组件包装已不再需要（@Component 类由运行时直接识别），
  // 装饰器交给 esbuild 的 legacy decorators 降级；JSX 降级仍由 automatic
  // runtime 完成（tsconfig: jsx: react-jsx + jsxImportSource @actview/jsx）。
  plugins: [],

  // @actview 源码里的编译期常量（Vue 源码约定）：
  // dev/test 为 true、生产构建为 false（esbuild define 只接受字面量，这里直接写 true/false）。
  define: {
    __DEV__: JSON.stringify(mode !== 'production'),
  },
  // TSX 统一走 @actview/jsx 的 automatic runtime（测试 / dev / build）
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: '@actview/jsx',
  },
  optimizeDeps: {
    // workspace 包直接消费源码（走 Vite transform，__DEV__ define 才能生效）
    exclude: [
      '@actview/reactivity',
      '@actview/shared',
      '@actview/core',
      '@actview/server',
      '@actview/devtools',
      '@actview/router',
      '@actview/jsx',
      '@actview/jsx/jsx-runtime',
      '@actview/jsx/jsx-dev-runtime',
    ],
  },
  resolve: {
    alias: {
      // 子路径必须先于包名声明（alias 按顺序匹配）：
      // TSX 编译产物会 import '@actview/jsx/jsx-dev-runtime'（dev）/
      // '@actview/jsx/jsx-runtime'（build），必须能解析到源码。
      '@actview/jsx/jsx-runtime': src('./packages/jsx/src/jsx-runtime.ts'),
      '@actview/jsx/jsx-dev-runtime': src('./packages/jsx/src/jsx-dev-runtime.ts'),
      '@actview/core/internal': src('./packages/core/src/internal.ts'),
      '@actview/core/server-internal': src('./packages/core/src/server-internal.ts'),
      '@actview/server': src('./packages/server/src/index.ts'),
      '@actview/vitepress': src('./packages/vitepress/src/client/index.ts'),
      '@actview/vitepress/plugin': src('./packages/vitepress/src/node/actviewPlugin.ts'),
      '@actview/jsx': src('./packages/jsx/src/index.ts'),
      '@actview/core': src('./packages/core/src/index.ts'),
      '@actview/devtools': src('./packages/devtools/src/index.ts'),
      '@actview/router': src('./packages/router/src/index.ts'),
      '@actview/reactivity': src('./packages/reactivity/src/index.ts'),
      '@actview/shared': src('./packages/shared/src/index.ts'),
      'actview': src('./packages/actview/src/index.ts'),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: [
      'packages/**/__tests__/**/*.spec.ts',
      'packages/**/__tests__/**/*.spec.tsx',
    ],
    setupFiles: ['./packages/reactivity/__tests__/setup.ts'],
    passWithNoTests: true,
  },
  server: {
    port: 3000,
    strictPort: true,
    open: true,
  },
}))
