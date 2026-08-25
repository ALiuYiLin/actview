import { defineConfig } from 'vite'
import { actviewPlugin } from '@actview/plugin-vite'

export default defineConfig({
  plugins: [actviewPlugin()],
  esbuild: {
    // 非组件函数的 JSX（如 main.tsx 顶层 hydrate 调用）由 esbuild 按自动 runtime 编译
    jsx: 'automatic',
    jsxImportSource: '@actview/jsx',
  },
  ssr: {
    // workspace 源码包不外部化：SSR 构建时把 actview 全家 bundle 进产物
    // （node_modules 下的软链包若外部化，Node 直接加载 TS 源码会失败）
    noExternal: ['actview', /^@actview\//],
  },
  build: {
    target: 'es2020',
  },
})
