// ============================================================
// getStateAttributesProps —— 移植自 base-ui internals/getStateAttributesProps.ts
//
// state → data-* 属性的默认映射：
//   true            → data-<key>=""          （布尔开关形态）
//   其他真值         → data-<key>="String(v)"
//   falsy(undefined/null/false) → 不产出
// StateAttributesMapping 允许逐键自定义：返回 null 表示该键不产出任何属性。
// ============================================================

export type StateAttributesMapping<State> = {
  [Property in keyof State]?: (
    state: State[Property],
  ) => Record<string, string> | null
}

export function getStateAttributesProps<State extends Record<string, any>>(
  state: State,
  customMapping?: StateAttributesMapping<State>,
) {
  const props: Record<string, string> = {}

  for (const key in state) {
    const value = state[key]

    if (customMapping?.hasOwnProperty(key)) {
      const customProps = customMapping[key]!(value)
      if (customProps != null) {
        Object.assign(props, customProps)
      }
      continue
    }

    if (value === true) {
      props[`data-${key.toLowerCase()}`] = ''
    } else if (value) {
      props[`data-${key.toLowerCase()}`] = value.toString()
    }
  }

  return props
}
