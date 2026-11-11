import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/vite.ts'],
  format: ['esm'],
  dts: { compilerOptions: { ignoreDeprecations: '6.0' } },
  clean: true,
  outDir: 'dist',
  // vite 是可选 peer（只有 ./vite 子路径需要）
  external: ['vite'],
})
