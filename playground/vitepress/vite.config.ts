import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { actviewMarkdown } from '@actview/vitepress/plugin'

const pkg = (rel: string) => fileURLToPath(new URL(rel, import.meta.url))

export default defineConfig({
  plugins: [actviewMarkdown()],
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: '@actview/jsx',
  },
  resolve: {
    alias: {
      'actview': pkg('../../packages/actview/src/index.ts'),
      '@actview/core/internal': pkg('../../packages/core/src/internal.ts'),
      '@actview/core': pkg('../../packages/core/src/index.ts'),
      '@actview/vitepress': pkg('../../packages/vitepress/src/actview/index.ts'),
      '@actview/jsx/jsx-runtime': pkg('../../packages/jsx/src/jsx-runtime.ts'),
      '@actview/jsx/jsx-dev-runtime': pkg('../../packages/jsx/src/jsx-dev-runtime.ts'),
      '@actview/jsx': pkg('../../packages/jsx/src/index.ts'),
      '@actview/reactivity': pkg('../../packages/reactivity/src/index.ts'),
      '@actview/shared': pkg('../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 3100,
    strictPort: true,
    open: true,
  },
})
