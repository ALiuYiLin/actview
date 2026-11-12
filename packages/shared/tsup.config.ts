import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: {
    compilerOptions: {
      ignoreDeprecations: '6.0',
      erasableSyntaxOnly: false,
      // 包 tsconfig.json 是 composite project（project references 构建用）；
      // tsup 的 dts 步骤按入口单文件建 program，composite 的文件列表校验会报
      // TS6307，因此在 dts 里关掉 composite（只影响 tsup 产物构建）。
      composite: false,
    },
  },
  clean: true,
  outDir: 'dist',
  // Vue 源码约定：__DEV__ 是编译期常量。esbuild 的 define 只接受字面量/标识符，
  // 这里用 banner 注入模块级常量，等价于上游 rollup 的 replace(__DEV__, ...)。
  // 消费方 bundler 会把 process.env.NODE_ENV 折叠为生产/开发分支。
  banner: {
    js: 'const __DEV__ = process.env.NODE_ENV !== "production";',
  },
})
