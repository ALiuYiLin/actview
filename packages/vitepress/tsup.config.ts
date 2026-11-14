import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/actview/index.ts', 'src/actview/plugin.ts'],
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
  external: ['actview', '@actview/core', 'vite'],
})
