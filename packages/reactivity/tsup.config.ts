import path from 'node:path'
import { defineConfig } from 'tsup'

// $actview/shared 源码路径：构建命令在包目录下执行（npm/pnpm script 均如此）
const sharedSrc = path.resolve(process.cwd(), '../shared/src/index.ts')

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: {
    // 派生自 Vue 源码：允许 enum 等非可擦除语法
    compilerOptions: {
      ignoreDeprecations: '6.0',
      erasableSyntaxOnly: false,
      // 包 tsconfig.json 是 composite project（project references 构建用）；
      // tsup 的 dts 步骤按入口单文件建 program，composite 的文件列表校验会报
      // TS6307，因此在 dts 里关掉 composite（只影响 tsup 产物构建）。
      composite: false,
      // dts program 会经 paths 拉入 @actview/shared 源码（../shared/src），
      // 放宽 rootDir 以免 TS6059；仅影响 tsup 的声明打包。
      rootDir: '..',
    },
  },
  clean: true,
  outDir: 'dist',
  // 编译期常量（Vue 源码约定）：esbuild define 只接受字面量/标识符，改用 banner
  // 注入模块级常量；发布产物由消费方 bundler 折叠 process.env.NODE_ENV。
  // dev 源码消费方（workspace/vite）需自行 define __DEV__（见 README）。
  banner: {
    js: 'const __DEV__ = process.env.NODE_ENV !== "production";',
  },
  esbuildOptions(options) {
    // workspace 内免 install 解析 @actview/shared（等价于 pnpm 的 workspace link）
    options.alias = {
      ...(options.alias ?? {}),
      '@actview/shared': sharedSrc,
    }
  },
})
