// ============================================================
// ref 处理（docs/renderer-design.md §7.3）
//
//   元素 ref → DOM 节点；组件 ref → 组件实例；卸载时传入 null。
//   M1 支持函数 ref 与 Ref 对象（{ value }）两种形态。
// ============================================================

/**
 * 设置 ref 的值。
 * - ref 为 null / undefined → 忽略（未声明 ref）
 * - 函数 → ref(value)（函数 ref）
 * - 对象且含 value 字段（Ref 形态）→ ref.value = value
 * - 其它 → warn 并忽略
 */
export function setRef(ref: unknown, value: unknown): void {
  if (ref == null) return

  if (typeof ref === 'function') {
    ;(ref as (value: unknown) => void)(value)
    return
  }

  if (typeof ref === 'object' && 'value' in (ref as object)) {
    ;(ref as { value: unknown }).value = value
    return
  }

  console.warn('[actview] 无效的 ref：期望函数或 Ref 对象。', ref)
}
