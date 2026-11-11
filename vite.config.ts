import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { actviewCompiler } from '@actview/compiler/vite'

const src = (rel: string) => fileURLToPath(new URL(rel, import.meta.url))

export default defineConfig(({ mode }) => ({
  plugins: [
    // L1（组件包装）在 esbuild 之前执行；JSX 降级（L2）由 esbuild 的
    // automatic runtime 完成（tsconfig: jsx: react-jsx + jsxImportSource
    // @actview/jsx），compiler 不再重复实现 JSX 转换。
    // packages/ 下的库包暂不经过本插件（库代码用显式 defineComponent，
    // 各自构建链负责发布产物；见 docs/compiler-layers.md §3）。
    actviewCompiler({
      exclude: [/[\\/]node_modules[\\/]/, /[\\/]packages[\\/]/],
    }),
  ],
  // @actview 源码里的编译期常量（Vue 源码约定）：
  // dev/test 为 true、生产构建为 false（esbuild define 只接受字面量，这里直接写 true/false）。
  define: {
    __DEV__: JSON.stringify(mode !== 'production'),
  },
  optimizeDeps: {
    // workspace 包直接消费源码（走 Vite transform，__DEV__ define 才能生效）
    exclude: [
      '@actview/reactivity',
      '@actview/shared',
      '@actview/core',
      '@actview/jsx',
      '@actview/jsx/jsx-runtime',
      '@actview/jsx/jsx-dev-runtime',
      '@actview/runtime-core',
    ],
  },
  resolve: {
    alias: {
      // 子路径必须先于包名声明（alias 按顺序匹配）：
      // TSX 编译产物会 import '@actview/jsx/jsx-dev-runtime'（dev）/
      // '@actview/jsx/jsx-runtime'（build），必须能解析到源码。
      '@actview/jsx/jsx-runtime': src('./packages/jsx/src/jsx-runtime.ts'),
      '@actview/jsx/jsx-dev-runtime': src('./packages/jsx/src/jsx-dev-runtime.ts'),
      '@actview/runtime-core/internal': src('./packages/runtime-core/src/internal.ts'),
      '@actview/jsx': src('./packages/jsx/src/index.ts'),
      '@actview/runtime-core': src('./packages/runtime-core/src/index.ts'),
      '@actview/core': src('./packages/core/src/index.ts'),
      // 直接映射到源码，dev / build 均免预构建（pnpm workspace link 存在时也一致）
      '@actview/reactivity': src('./packages/reactivity/src/index.ts'),
      '@actview/shared': src('./packages/shared/src/index.ts'),
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
