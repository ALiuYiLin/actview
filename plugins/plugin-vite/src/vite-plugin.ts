// ============================================================
// Vite 插件
// .tsx 文件在 esbuild 之前过一遍 Babel，做 defineComponent 转换
// 编译核心（defineComponentPlugin）与宿主壳（createBabelTransform）
// 均见 @actview/babel-plugin-actview
// ============================================================

import { createBabelTransform, defineComponentPlugin, solidPlugin } from '@actview/babel-plugin-actview'

// 模块级只创建一次 Babel 转换器（内部缓存 ConfigItem，Babel 8 同步版本）
const transform = createBabelTransform([defineComponentPlugin, solidPlugin])

export function actviewPlugin() {
  return {
    name: 'actview-transform',
    enforce: 'pre' as const,
    async transform(code: string, id: string) {
      // rolldown-vite dev 的模块 id 带 ?t= 时间戳 query（HMR），剥掉再判断扩展名，
      // 否则 `id.endsWith('.tsx')` 永不匹配、Babel 转换不执行 → 组件以裸函数
      // 进入 ActView 运行时（只认 { __setup } VNode）→ createElement('function ...')
      const cleanId = id.split('?')[0]
      // 也处理 .js：vitepress 的 dist/client 是 tsc 编译产物（.js，JSX 已降级为
      // _jsx() 调用，位于 node_modules 下），浏览器加载的是这些 .js 而非源码
      // .tsx——不能按 node_modules 跳过，否则函数组件以裸函数进入运行时崩溃
      if (!cleanId.endsWith('.tsx') && !cleanId.endsWith('.js')) return null

      const result = transform(code, id)
      if (!result) return null
      return {
        code: result.code,
        map: result.map as any,
      }
    },
  }
}
