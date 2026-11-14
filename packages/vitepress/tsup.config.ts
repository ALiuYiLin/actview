import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/client/index.ts', 'src/node/actviewPlugin.ts'],
  format: ['esm'],
  dts: {
    compilerOptions: {
      ignoreDeprecations: '6.0',
      composite: false,
      rootDir: '..',
    },
  },
  clean: true,
  outDir: 'dist',
  external: ['actview', '@actview/core', 'vite', /\.css(\?.*)?$/],
})
