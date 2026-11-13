// ============================================================
// Teleport — 内置组件标记 + 目标容器解析（docs/renderer.md）
//
//   renderer 按 `type.__builtin === 'teleport'` 识别本组件，children 的
//   patch / 插入 / 卸载由 renderer 负责（内容渲染到 target 容器，源码位置
//   不产生 DOM）。本模块只提供：
//   - Teleport 标记（运行时普通对象，不是 setup 组件）；
//   - resolveTeleportTarget：把 props.to（选择器 / Element）解析成目标容器。
// ============================================================

import type { BuiltinComponent } from '../internal'

/** Teleport 内置组件标记（renderer 只按 `__builtin` 字段识别） */
export const Teleport = {
  __builtin: 'teleport',
} as unknown as BuiltinComponent

/**
 * 解析 Teleport 的目标容器。
 * - string → document.querySelector（找不到抛明确错误）
 * - Element → 原样返回
 * - 其它 → 抛错
 */
export function resolveTeleportTarget(to: unknown): Element {
  if (typeof to === 'string') {
    const target = document.querySelector(to)
    if (!target) {
      throw new Error(
        `[actview] Teleport 目标选择器未匹配到元素: "${to}"`,
      )
    }
    return target
  }

  if (isElement(to)) return to

  throw new Error(
    '[actview] Teleport 的 to 必须是 CSS 选择器字符串或 Element 节点',
  )
}

/** 跨 realm 安全的 Element 判定（instanceof 在 SSR / 自定义环境不可靠） */
function isElement(value: unknown): value is Element {
  if (value == null || typeof value !== 'object') return false
  if (typeof Element !== 'undefined' && value instanceof Element) return true
  // nodeType === 1 即 element（同时覆盖 cross-realm 场景）
  return (value as { nodeType?: unknown }).nodeType === 1
}
