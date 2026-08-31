// ============================================================
// CheckboxGroup —— 注册表 + 选中值统管（React 对齐）
//
// 与 Base UI CheckboxGroup 的对应关系：
//   value          → 受控选中值数组（string[]）；缺省 = 非受控
//   defaultValue   → 非受控初始值
//   onValueChange  → 选中变化回调（绑在 Group 上，不散到每个 Root）
//   groupRef       → 拿到群体 API（members 注册表 / focusFirst）
//
// 自身不持有任何 DOM ref：真正的多 ref 合并发生在每个 CheckboxRoot
// 内部（useMergedRefs）。本组件的价值是【群体视角】：
//   - members 响应式数组 → 「全选/状态栏/校验」等群体逻辑的数据来源
//   - checkedValues/toggleValue → Root 统一从这里读勾选状态、上报翻转
//
// 受控/非受控：
//   受控（value 非空）：checkedValues 派生自 props.value，翻转时只回调
//   onValueChange，由使用方更新 value 驱动重渲染；
//   非受控（value 缺省）：内部 ref 维护，翻转时更新自身并回调。
// ============================================================

import {
  computed,
  reactive,
  ref,
  toRefs,
  type Reactive,
  type Ref,
} from 'actview'
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
  /** 受控选中值数组（React 对齐：Group 统管勾选状态） */
  value?: string[]
  /** 非受控初始值 */
  defaultValue?: string[]
  /** 选中变化回调（React 对齐：绑在 Group 上） */
  onValueChange?: (values: string[], event?: unknown) => void
  /** 拿到 group API——供外部状态栏/全选按钮等使用(写 .value 一次性赋值) */
  groupRef?: Ref<CheckboxGroupApi | null>
  /** vue 原生插槽（默认插槽 props.slots.default()） */
  slots?: any
  /** 其余键透传到 group 根 div（className/style/aria-* 等） */
  [key: string]: any
}

export function CheckboxGroup(props: CheckboxGroupProps) {
  const members = reactive<CheckboxRegistration[]>([])

  // ---- 选中值：受控 / 非受控 ----
  const internalValues = ref<string[]>(props.defaultValue ?? [])
  const isControlled = () => props.value != null
  const checkedValues = computed<string[]>(() =>
    isControlled() ? props.value! : internalValues.value,
  )

  const toggleValue = (value: string | undefined, event?: unknown) => {
    if (value == null) return
    const cur = checkedValues.value
    const next = cur.includes(value)
      ? cur.filter((v) => v !== value)
      : [...cur, value]
    if (isControlled()) {
      // 受控：只上报，由 value prop 驱动
      props.onValueChange?.(next, event)
    } else {
      internalValues.value = next
      props.onValueChange?.(next, event)
    }
  }

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
    checkedValues,
    toggleValue,
  }

  // 使用方通过 groupRef 拿到同一个 api 对象(引用稳定)
  // ⚠️ 使用方传 ref 本体时须经 rawRef 包裹(否则被 jsxFactory 解包成值快照)
  if (props.groupRef) props.groupRef.value = group

  // ---- 宿主透传（排除框架消费键；渲染期取值保持活引用） ----
  const {
    groupRef: _gr,
    slots: _s,
    value: _v,
    defaultValue: _dv,
    onValueChange: _ov,
    ...restRefs
  } = toRefs(props) as Record<string, Ref<any>>
  const passthrough = computed<Record<string, any>>(() => {
    const out: Record<string, any> = {}
    for (const k in restRefs) out[k] = restRefs[k].value
    return out
  })

  return (
    <CheckboxGroupContext.Provider value={group}>
      <div role="group" data-checkbox-group="" {...passthrough.value}>
        {props.slots?.default?.()}
      </div>
    </CheckboxGroupContext.Provider>
  )
}
