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
