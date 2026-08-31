// ============================================================
// CheckboxIndicator —— 勾选指示器（React 对齐）
//
// 对应 Base UI 的 Checkbox.Indicator：渲染在 Root 内部的小方块，
// 勾选状态从 CheckboxRootContext 读取（computed ref，渲染期读取即
// 追踪），不依赖 render prop——视觉与状态解耦。
//
// 默认形态：<span data-checked="true|false">，勾选时显示 ✓。
// ============================================================

import { computed } from 'actview'
import { useCheckboxRootContext } from './checkbox-root-context'

const indicatorStyle: any = {
  display: 'inline-flex',
  width: 16,
  height: 16,
  borderRadius: 4,
  border: '1px solid #94a3b8',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  lineHeight: 1,
  color: '#fff',
  background: 'transparent',
  transition: 'background 120ms',
  flexShrink: 0,
}

export function CheckboxIndicator() {
  const rootCtx = useCheckboxRootContext()
  const checked = computed(() => rootCtx?.checked.value ?? false)
  return (
    <span
      data-checked={String(checked.value)}
      style={{ ...indicatorStyle, background: checked.value ? '#4338ca' : 'transparent' }}
    >
      {checked.value ? '✓' : ''}
    </span>
  )
}
