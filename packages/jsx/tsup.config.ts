import path from 'node:path'
import { defineConfig } from 'tsup'

// @actview/core 源码路径：构建命令在包目录下执行
const coreSrc = path.resolve(process.cwd(), '../core/src/index.ts')

export default defineConfig({
  entry: ['src/index.ts', 'src/jsx-runtime.ts', 'src/jsx-dev-runtime.ts'],
  format: ['esm'],
  dts: {
    compilerOptions: {
      ignoreDeprecations: '6.0',
      // 包 tsconfig.json 是 composite project（project references 构建用）；
      // tsup 的 dts 步骤按入口单文件建 program，composite 的文件列表校验会报
      // TS6307，因此在 dts 里关掉 composite（只影响 tsup 产物构建）。
      composite: false,
      // dts program 会经 paths 拉入 @actview/core 源码，放宽 rootDir
      // 以免 TS6059；仅影响 tsup 的声明打包。
      rootDir: '..',
    },
  },
  clean: true,
  outDir: 'dist',
  esbuildOptions(options) {
    // workspace 内免 install 解析 @actview/core（等价 workspace link）
    options.alias = {
      ...(options.alias ?? {}),
      '@actview/core': coreSrc,
    }
  },
})
