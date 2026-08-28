// ============================================================
// useMergedRefs —— 多 ref 合并（移植自 @base-ui/utils/useMergedRefs 的语义）
//
// 返回一个「委托型 ref 对象」：写 .value 时广播到全部源 ref
// （函数 ref 调用、对象 ref 写 .value）；读 .value 返回最近一次写入值。
// ActView 的 renderer applyRef 接受任意 { value } 对象（renderer.ts:158-162），
// 因此该代理可直接挂到元素上。与 React 不同，ActView 没有 hooks 规则约束，
// 本工厂按普通函数使用（每次渲染重建开销可忽略）。
// ============================================================

export type AnyRef = { value: any } | ((v: any) => void) | null | undefined

export function useMergedRefs(...refs: AnyRef[]): { value: any } {
  let lastValue: any
  const write = (v: any) => {
    lastValue = v
    for (const r of refs) {
      if (!r) continue
      if (typeof r === 'function') (r as (v: any) => void)(v)
      else (r as { value: any }).value = v
    }
  }
  return {
    get value() {
      return lastValue
    },
    set value(v: any) {
      write(v)
    },
  } as { value: any }
}
