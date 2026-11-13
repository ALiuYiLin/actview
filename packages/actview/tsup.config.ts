import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: {
    compilerOptions: {
      ignoreDeprecations: '6.0',
      // 包 tsconfig.json 是 composite project；tsup dts 按入口单文件建 program，
      // 关闭 composite 以避免 TS6307（只影响 tsup 声明产物构建）。
      composite: false,
      // dts program 经 paths 拉入 @actview/core 源码，放宽 rootDir 以免 TS6059。
      rootDir: '..',
    },
  },
  clean: true,
  outDir: 'dist',
  external: ['@actview/core'],
})
