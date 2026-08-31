// ============================================================
// CheckboxRoot 上下文 —— Root → Indicator 的勾选状态通道
//
// Group 的 checkedValues 管「群体选中数组」，而 Indicator（以及未来
// 的样式化子部件）需要知道【自己所属 Root 的勾选状态】。Root 渲染时
// 以 Provider 包裹输出，value = { checked, disabled }（computed ref，
// 消费方渲染期 .value 读取即追踪）。无 Group 独立使用时同样有效
// （checked 来自 Root 内部非受控状态）。
// ============================================================

import { createContext } from 'actview'
import type { Ref } from 'actview'

export interface CheckboxRootContextValue {
  /** 勾选状态（computed ref，渲染期读取追踪） */
  checked: Ref<boolean>
  /** 禁用状态（computed ref） */
  disabled: Ref<boolean>
}

export const CheckboxRootContext =
  createContext<CheckboxRootContextValue | undefined>(undefined)

export function useCheckboxRootContext(): CheckboxRootContextValue | null {
  const ctx = CheckboxRootContext.use()
  return ctx ?? null
}
