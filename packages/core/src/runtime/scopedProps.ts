// ============================================================
// scoped props — 组件边界 scoped 传递（@actview/plugin-scoped 运行时协议）
//
// 背景：ActView 无 attr fallthrough，父组件的 scoped 属性不会自动落到
// 子组件根。编译期插件对所有 JSX 元素统一注入 data-v-<hash>=""（与原生
// 元素一致，不做组件/原生区分——组件判定是运行时语义：vnode.type.__setup）。
// 运行时在组件边界把注入形态的 data-v-* 属性（值为空字符串）提取合并为
// scopedId prop 传给子组件；子组件在 props 声明 scopedId?: string 并手动
// 应用到根元素（<div scopedId={props.scopedId}> 或 <div {...props}>），
// 原生元素侧的 patchProps/serializeAttrs 把 scopedId 翻译回真实 scoped 属性。
//
// 为什么用 data-v-* + 空值做识别：插件的注入产物统一是该形态（JSX 属性
// data-v-x="" 与 _jsx 对象属性 "data-v-x": "" 一致）；用户自定义传参的
// data-v-*（非空值）不属于 scoped 注入，原样透传。
// 已知限制：自定义 attrPrefix（非 data-v）时组件边界转换不识别（原生元素
// 不受影响），需改用默认前缀或自行传 scopedId。
// ============================================================

/** scoped 标记 prop 名：值为 scoped 属性名（可空格分隔多个） */
export const SCOPED_ID_PROP = 'scopedId'

/** scoped 注入属性前缀（与插件默认 attrPrefix 'data-v' 一致） */
const SCOPED_ATTR_RE = /^data-v-/

/** scopedId 值拆分：空格分隔的 scoped 属性名列表 */
export function splitScopedId(value: any): string[] {
  if (typeof value !== 'string' || !value) return []
  return value.split(/\s+/).filter(Boolean)
}

/**
 * 组件边界 props 提取（原地修改）：把注入形态的 data-v-*（值为 ''）合并为
 * scopedId prop（与已有 scopedId 值拼接），并删除原 data-v-* 键。
 * 非空值的 data-v-* 视为用户自定义 prop，原样保留。
 */
export function extractScopedIdProps(props: Record<string, any> | null | undefined): void {
  if (!props) return
  const scopedAttrs: string[] = []
  for (const key of Object.keys(props)) {
    if (SCOPED_ATTR_RE.test(key) && props[key] === '') {
      scopedAttrs.push(key)
    }
  }
  if (scopedAttrs.length === 0) return
  const existing = typeof props[SCOPED_ID_PROP] === 'string' ? props[SCOPED_ID_PROP] : ''
  props[SCOPED_ID_PROP] = [...splitScopedId(existing), ...scopedAttrs].join(' ')
  for (const key of scopedAttrs) {
    delete props[key]
  }
}
