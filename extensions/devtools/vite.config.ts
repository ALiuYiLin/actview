import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const pkg = (rel: string) =>
  fileURLToPath(new URL(`../../packages/${rel}`, import.meta.url))

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: '@actview/jsx',
  },
  define: {
    __DEV__: 'false',
  },
  resolve: {
    alias: {
      'actview': pkg('actview/src/index.ts'),
      '@actview/jsx/jsx-runtime': pkg('jsx/src/jsx-runtime.ts'),
      '@actview/jsx/jsx-dev-runtime': pkg('jsx/src/jsx-dev-runtime.ts'),
      '@actview/jsx': pkg('jsx/src/index.ts'),
      '@actview/core/internal': pkg('core/src/internal.ts'),
      '@actview/core': pkg('core/src/index.ts'),
      '@actview/reactivity': pkg('reactivity/src/index.ts'),
      '@actview/shared': pkg('shared/src/index.ts'),
    },
  },
  build: {
    outDir: 'build',
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    lib: {
      entry: fileURLToPath(new URL('./src/panel.tsx', import.meta.url)),
      formats: ['es'],
      fileName: () => 'panel.js',
    },
    rollupOptions: {
      output: {
        entryFileNames: 'panel.js',
        chunkFileNames: 'panel-[name].js',
        assetFileNames: 'panel.[ext]',
      },
    },
  },
})
