// ============================================================
// 组件挂载 — 用户思路的核心
//   const render = __setup(props)      // props 为普通对象
//   runEffect(() => {
//     const newVnode = render()
//     patch(oldVnode, newVnode)   // 响应式变化时自动执行
//   })
// ============================================================

import { runEffect } from './reactive-system'
import { patch } from './renderer'

/** 组件实例：保存 setup/render 及当前子树 */
export interface ComponentInstance {
  setup: (props: any) => () => any
  /** 普通对象 props：由父组件 patch 时更新值并手动调用 update() */
  props: any
  render: () => any
  subTree: any
  update: () => void
  unmount: () => void
}

/** 挂载组件 VNode：实例化并建立响应式更新 effect */
export function mountComponent(vnode: any, container: Element | null) {
  const options = vnode.type
  if (options == null || typeof options !== 'object' || typeof options.__setup !== 'function') {
    throw new Error('[actview] mountComponent: 无效的组件，缺少 __setup')
  }

  // props 为普通对象：父组件通过 patchComponent 更新值 + 手动 update()
  const props = { ...(vnode.props || {}) }

  const instance: ComponentInstance = {
    setup: options.__setup,
    props,
    render: options.__setup(props),
    subTree: null,
    update: () => {},
    unmount: () => {},
  }
  vnode.component = instance

  // 更新函数：重新 render 并与旧子树 patch
  const update = () => {
    const newSubTree = instance.render()
    const oldSubTree = instance.subTree
    instance.subTree = newSubTree
    patch(oldSubTree, newSubTree, container as Element)
    // 刷新组件 VNode 的 el（子树根可能因条件渲染而改变）
    vnode.el = instance.subTree ? instance.subTree.el : null
  }

  // runEffect 立即执行首次挂载；之后响应式数据变化自动重跑 update
  const effect = runEffect(update)

  // props 更新路径（父组件 patchComponent 手动调度）也必须走完整 effect 语义：
  // cleanup 旧依赖 + 设置 activeEffect 上下文，否则裸调用 update 会把调用方
  // （父 effect）误收集进本组件的内部响应式依赖，导致父组件被连带重渲染
  instance.update = () => effect.run()

  instance.unmount = () => {
    effect.stop()
  }

  // 组件 VNode 的 el 指向其子树根节点
  vnode.el = instance.subTree ? instance.subTree.el : null
}
