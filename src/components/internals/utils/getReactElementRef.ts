/**
 * 从渲染节点提取 ref。
 * React 19 把 ref 放进 props;ActView 的 vnode 形态与 React 19 一致
 * （createVNode: { $$typeof, type, key, ref: null, props }——ref 恒在 props.ref）。
 * 移植自 @base-ui/utils/getReactElementRef（React 19 分支路径）。
 */
export function getReactElementRef(element: unknown): any | null {
  const el = element as { props?: { ref?: any } | null } | null | undefined
  if (!el || typeof el !== 'object' || !el.props) return null
  return el.props.ref ?? null
}
