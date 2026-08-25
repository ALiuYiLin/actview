import { defineConfig } from 'tsup'

export default defineConfig([
  // 服务端：Node ESM，bundle actview + 组件；node:* 外部化
  {
    entry: ['src/entry-server.tsx'],
    platform: 'node',
    format: ['esm'],
    external: ['node:*'],
    outDir: 'dist',
    clean: true,
    target: 'node20',
  },
  // 客户端：浏览器 IIFE 单文件，内联 actview（entry-client.js 由服务端静态提供）
  {
    entry: ['src/entry-client.tsx'],
    platform: 'browser',
    format: ['iife'],
    outDir: 'dist',
    target: 'es2020',
    outExtension: () => ({ js: '.js' }),
  },
])
