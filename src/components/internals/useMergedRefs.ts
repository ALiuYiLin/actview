// ============================================================
// useMergedRefs —— 多 ref 合并（移植自 @base-ui/utils/useMergedRefs 的语义）
//
// v2：返回【函数 ref】（vue 3.5 模板 ref 只接受 RefImpl 与函数——
// 普通 { value } 对象缺 owner 会被 setRef 跳过并 warn）。
// 调用时（挂载 el / 卸载 null）广播到全部源 ref：函数 ref 调用、
// 对象 ref 写 .value。
// ============================================================

export type AnyRef = { value: any } | ((v: any) => void) | null | undefined

export function useMergedRefs(...refs: AnyRef[]): (v: any) => void {
  const write = (v: any) => {
    for (const r of refs) {
      if (!r) continue
      if (typeof r === 'function') (r as (v: any) => void)(v)
      else (r as { value: any }).value = v
    }
  }
  return write
}
