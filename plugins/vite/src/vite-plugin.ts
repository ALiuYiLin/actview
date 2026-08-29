// ============================================================
// Vite 插件
// .tsx/.ts 文件在 esbuild 之前过一遍 Babel，做 defineComponent 转换
// 编译核心（defineComponentPlugin）与宿主壳（createBabelTransform）
// 均见 @actview/plugin-babel
// ============================================================

import { createBabelTransform, defineComponentPlugin, solidPlugin } from '@actview/plugin-babel'
import type { BabelTransformOptions } from '@actview/plugin-babel'

export interface ActviewPluginOptions {
  /**
   * Babel 宿主壳排除规则透传（node_modules 硬排除，不可覆盖）。
   * 源码分发库包需要现场编译时：vite config 里 alias 到包源码 +
   * optimizeDeps.exclude，让路径脱离 node_modules 段即可正常转换。
   */
  babel?: BabelTransformOptions
}

export function actviewPlugin(options: ActviewPluginOptions = {}) {
  // 只创建一次 Babel 转换器（内部缓存 ConfigItem，Babel 8 同步版本）
  const transform = createBabelTransform(
    [defineComponentPlugin, solidPlugin],
    options.babel,
  )
  return {
    name: 'actview-transform',
    enforce: 'pre' as const,
    async transform(code: string, id: string) {
      // rolldown-vite dev 的模块 id 带 ?t= 时间戳 query（HMR），剥掉再判断扩展名，
      // 否则 `id.endsWith('.tsx')` 永不匹配、Babel 转换不执行 → 组件以裸函数
      // 进入 ActView 运行时（只认 { __setup } VNode）→ createElement('function ...')
      const cleanId = id.split('?')[0]
      // 也处理 .js（tsc 编译产物，JSX 已降级为 _jsx() 调用）与 .ts
      // （esbuild/oxc 默认不解析 .ts 里的 JSX，含 JSX 的 .ts 需经本插件；
      // 无 JSX 的 .ts 经 babel 原样再生，语义不变）。
      // node_modules 下的文件由宿主壳硬排除（不转换，依赖已由 esbuild
      // 预构建）；源码分发库包需要现场编译时，在 vite config 里 alias 到
      // 包源码 + optimizeDeps.exclude，使路径脱离 node_modules 段。
      if (
        !cleanId.endsWith('.tsx') &&
        !cleanId.endsWith('.ts') &&
        !cleanId.endsWith('.js')
      ) {
        return null
      }

      const result = transform(code, id)
      if (!result) return null
      return {
        code: result.code,
        map: result.map as any,
      }
    },
  }
}
