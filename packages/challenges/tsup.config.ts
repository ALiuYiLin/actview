import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm'],
  dts: { compilerOptions: { ignoreDeprecations: '6.0' } },
  clean: true,
  outDir: 'dist',
})
