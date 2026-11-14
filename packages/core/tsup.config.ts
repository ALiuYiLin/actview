import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/server-internal.ts'],
  format: ['esm'],
  dts: {
    compilerOptions: {
      ignoreDeprecations: '6.0',
      // 包 tsconfig.json 是 composite project（project references 构建用）；
      // tsup 的 dts 步骤按入口单文件建 program，composite 的文件列表校验会报
      // TS6307，因此在 dts 里关掉 composite（只影响 tsup 产物构建）。
      composite: false,
      // dts program 会经 paths 拉入 reactivity/shared 源码，
      // 放宽 rootDir 以免 TS6059；仅影响 tsup 的声明打包。
      rootDir: '..',
    },
  },
  clean: true,
  outDir: 'dist',
})
