// ============================================================
// CheckboxGroup 上下文 —— 注册表 + 选中值统管通道
//
// Group 不持有 DOM，它提供两件事：
//   1. 注册表：每个 Checkbox 把自己的隐藏 <input> 以【函数 ref】形式
//      登记进来（挂载 → register(el)、卸载 → register(null)），供
//      成员收集 / 反注册 / focusFirst 等群体操作使用。
//   2. 选中值统管（React 对齐）：checkedValues（当前选中数组）与
//      toggleValue（翻转某个成员值）。Root 不自己维护勾选状态，
//      渲染期从 checkedValues 派生，点击时经 toggleValue 上报——
//      受控形态只回调 onValueChange，由 Group 的 value prop 驱动。
// ============================================================

import { createContext } from 'actview'
import type { Reactive, Ref } from 'actview'

/** 单个成员的注册信息(el 为 null 表示「已卸载/反注册」) */
export interface CheckboxRegistration {
  el: HTMLInputElement | null
  /** 提交值(来自 Checkbox 的 value prop) */
  value?: string
  /** 该成员的控制 ref——Group 可借此反向操作对应 DOM */
  controlRef: Ref<HTMLInputElement | null>
}

export interface CheckboxGroupContext {
  /** upsert:el 非 null 注册/更新,null 反注册(按注册对象身份) */
  register(reg: CheckboxRegistration): void
  /** 当前成员(reactive 数组,读取即追踪) */
  members: Reactive<CheckboxRegistration[]>
  /** 群体操作示例:聚焦第一个成员的 input */
  focusFirst(): void
  /** 当前选中值(computed ref;受控 = props.value,非受控 = 内部维护) */
  checkedValues: Ref<string[]>
  /** 翻转某个成员值:受控 → 只回调 onValueChange;非受控 → 内部更新 + 回调 */
  toggleValue(value: string | undefined, event?: unknown): void
}

export const CheckboxGroupContext =
  createContext<CheckboxGroupContext | undefined>(undefined)

export function useCheckboxGroupContext(): CheckboxGroupContext | null {
  // Checkbox 可独立使用(无 Group)→ 缺省返回 null,由调用方降级
  const ctx = CheckboxGroupContext.use()
  return ctx ?? null
}
