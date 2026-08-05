import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/jsx-runtime.ts',
    'src/jsx-dev-runtime.ts',
    'src/global.ts'
  ],
  format: ['esm'],
  dts: { compilerOptions: { ignoreDeprecations: '6.0' } },
  clean: true,
  outDir: 'dist'
})
