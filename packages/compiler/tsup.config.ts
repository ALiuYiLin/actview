import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/vite.ts'],
  format: ['esm'],
  dts: {
    compilerOptions: {
      ignoreDeprecations: '6.0',
      // 包 tsconfig.json 是 composite project（project references 构建用）；
      // tsup 的 dts 步骤按入口单文件建 program，composite 的文件列表校验会报
      // TS6307，因此在 dts 里关掉 composite（只影响 tsup 产物构建）。
      composite: false,
    },
  },
  clean: true,
  outDir: 'dist',
  // vite 是可选 peer（只有 ./vite 子路径需要）
  external: ['vite'],
})
