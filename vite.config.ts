import { defineConfig } from 'vitest/config'
import path from 'path'
import { actviewJsxPlugin } from '@actview/plugin-vite'
import { actviewScopedPlugin } from '@actview/plugin-scoped'

const SRC_DIR = path.resolve(__dirname, 'src').replace(/\\/g, '/')
const TEST_DIR = path.resolve(__dirname, 'test').replace(/\\/g, '/')

export default defineConfig({
  // Vue 编译期 feature flags（esm-bundler build 需要全局注入，否则：
  // 1) 运行时 warnOnce 提示；2) 生产包无法摇树裁剪 Options API / devtools / hydration 细节）
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  plugins: [
    // v2 管线：React 语义 JSX 编译（仓库根 src/ demo 区 + test/ 全部：
    // v2 测试 + 迁移到 v2 引擎的 v1 行为测试）
    // ⚠️ include/exclude 规则需正斜杠（babel-host 会把 filename 归一为正斜杠）；
    // 且用绝对路径——'/src/' 会误匹配 packages/*/src
    actviewJsxPlugin({
      babel: { include: [SRC_DIR, TEST_DIR] },
    }),
    // ⚠️ 顺序：scoped 先注入 data-v-* 属性（JSX 源码形态），
    // actviewJsxPlugin 后转 createVNode（保留注入的属性）
    ...actviewScopedPlugin(),
  ],
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.{ts,tsx}', 'plugins/**/test/*.test.ts'],
  },
  server: {
    port: 3000,
    strictPort: true,
    open: true,
  },
})
