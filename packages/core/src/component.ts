// ============================================================
// mountComponent — 统一组件挂载逻辑
// 从 render.ts 拆分至此，避免与 patch.ts 循环依赖
// ============================================================
import { type VNodeChildren } from '@actview/jsx'
import { render } from './render'
import { patch } from './patch'
import { getCurrentUpdateFn, setCurrentUpdateFn } from './reactivity/update'

// ============================================================
// MountTarget — 挂载策略接口
// ============================================================
export interface MountTarget {
  update(nodes: Node[], container: Node): void
}

// ============================================================
// mountComponent — 统一组件挂载逻辑
// ============================================================
export function mountComponent(
  componentFn: (props: Record<string, unknown>) => () => VNodeChildren,
  container: Node,
  apply: MountTarget,
  props: Record<string, unknown> = {},
): { refresh: () => void } {
  // ① setup
  const renderFn = componentFn(props)

  // 保存旧 VNode 树，供 patch 使用
  let oldTree: VNodeChildren | null = null

  // ② doRender — 首次用 render，后续用 patch
  const doRender = () => {
    const newTree = renderFn()
    if (oldTree) {
      patch(oldTree, newTree, container)
    } else {
      const dom = render(newTree)
      const nodes = Array.isArray(dom) ? dom : [dom]
      apply.update(nodes, container)
    }
    oldTree = newTree
  }

  // ③ refresh
  const refresh = () => {
    const prev = getCurrentUpdateFn()
    setCurrentUpdateFn(refresh)
    doRender()
    setCurrentUpdateFn(prev)
  }

  // ④ 首次渲染
  const prev = getCurrentUpdateFn()
  setCurrentUpdateFn(refresh)
  doRender()
  setCurrentUpdateFn(prev)

  return { refresh }
}
