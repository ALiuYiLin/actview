import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

const pkg = (rel: string) => fileURLToPath(new URL(rel, import.meta.url))

export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss()],
  // playground 源码统一使用 @actview/jsx automatic runtime
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: '@actview/jsx',
  },
  define: {
    __DEV__: JSON.stringify(mode !== 'production'),
  },
  optimizeDeps: {
    exclude: [
      'actview',
      '@actview/core',
      '@actview/devtools',
      '@actview/jsx',
      '@actview/reactivity',
      '@actview/shared',
    ],
  },
  resolve: {
    alias: {
      'actview': pkg('../../packages/actview/src/index.ts'),
      '@actview/devtools': pkg('../../packages/devtools/src/index.ts'),
      '@actview/jsx/jsx-runtime': pkg('../../packages/jsx/src/jsx-runtime.ts'),
      '@actview/jsx/jsx-dev-runtime': pkg('../../packages/jsx/src/jsx-dev-runtime.ts'),
      '@actview/jsx': pkg('../../packages/jsx/src/index.ts'),
      '@actview/core/internal': pkg('../../packages/core/src/internal.ts'),
      '@actview/core': pkg('../../packages/core/src/index.ts'),
      '@actview/reactivity': pkg('../../packages/reactivity/src/index.ts'),
      '@actview/shared': pkg('../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    open: true,
  },
}))
