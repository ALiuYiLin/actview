// ============================================================
// CheckboxGroup —— 注册表提供方
//
// 自身不持有任何 DOM ref:它只提供 register(registration) 约定。
// 真正的多 ref 合并发生在每个 CheckboxRoot 内部(useMergedRefs)——
// 本组件的价值是【群体视角】:members 响应式数组让「全选/状态栏/校验」
// 这类群体逻辑有据可查,focusFirst 演示群体操作 DOM。
// ============================================================

import { reactive, type Reactive, type Ref } from 'actview'
import {
  CheckboxGroupContext,
  type CheckboxRegistration,
} from './checkbox-context'

/** 暴露给使用方的群体 API(members 为 reactive 数组,读取即追踪) */
export interface CheckboxGroupApi {
  members: Reactive<CheckboxRegistration[]>
  focusFirst(): void
}

export interface CheckboxGroupProps {
  /** 拿到 group API——供外部状态栏/全选按钮等使用(写 .value 一次性赋值) */
  groupRef?: Ref<CheckboxGroupApi | null>
  children?: any
}

export function CheckboxGroup(props: CheckboxGroupProps) {
  const members = reactive<CheckboxRegistration[]>([])

  const group: CheckboxGroupContext = {
    register(reg: CheckboxRegistration) {
      // vue 的 reactive 数组类型会 UnwrapRef 解包元素里的 Ref（类型层面），
      // 运行时 ref 原样保留——indexOf 参数断言回原类型
      if (reg.el == null) {
        // 反注册:按注册对象身份移除(函数 ref 在卸载时收到 null)
        const i = members.indexOf(reg as any)
        if (i >= 0) members.splice(i, 1)
        return
      }
      // upsert:同一注册对象重复挂载只更新
      const i = members.indexOf(reg as any)
      if (i >= 0) members[i] = reg as any
      else members.push(reg as any)
    },
    members,
    focusFirst() {
      members[0]?.el?.focus()
    },
  }

  // 使用方通过 groupRef 拿到同一个 api 对象(引用稳定)
  // ⚠️ 使用方传 ref 本体时须经 rawRef 包裹(否则被 jsxFactory 解包成值快照)
  if (props.groupRef) props.groupRef.value = group

  return (
    <CheckboxGroupContext.Provider value={group}>
      <div role="group" data-checkbox-group="">
        {props.children}
      </div>
    </CheckboxGroupContext.Provider>
  )
}
