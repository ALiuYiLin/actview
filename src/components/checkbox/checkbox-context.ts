// ============================================================
// CheckboxGroup 上下文 —— 多 ref 场景的「父级注册」通道
//
// Group 不持有 DOM,它只提供注册表:每个 Checkbox 把自己的隐藏 <input>
// 以【函数 ref】形式登记进来(挂载 → register(el)、卸载 → register(null)),
// 从而实现:
//   - 成员收集(表单校验/全选等群体操作的数据来源)
//   - 反注册(卸载/disabled 时从注册表移除——函数 ref 收到 null)
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
}

export const CheckboxGroupContext =
  createContext<CheckboxGroupContext | undefined>(undefined)

export function useCheckboxGroupContext(): CheckboxGroupContext | null {
  // Checkbox 可独立使用(无 Group)→ 缺省返回 null,由调用方降级
  const ctx = CheckboxGroupContext.use()
  return ctx ?? null
}
