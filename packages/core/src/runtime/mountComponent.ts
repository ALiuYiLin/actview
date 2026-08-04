// ============================================================
// 组件挂载 — 用户思路的核心
//   const render = __setup(props)      // props 为普通对象
//   runEffect(() => {
//     const newVnode = render()
//     patch(oldVnode, newVnode)   // 响应式变化时自动执行
//   })
// ============================================================

import { runEffect, queueJob } from './reactive-system'
import { patch } from './renderer'
import { setCurrentInstance } from './lifecycle'

/** 组件实例：保存 setup/render 及当前子树 */
export interface ComponentInstance {
  setup: (props: any) => () => any
  /** 普通对象 props：由父组件 patch 时更新值并手动调用 update() */
  props: any
  render: () => any
  subTree: any
  update: () => void
  unmount: () => void
  /** 是否已完成首次挂载（区分 mounted / updated） */
  isMounted: boolean
  /** 挂载容器（keep-alive 恢复 DOM 时使用） */
  container: Element | null
  /** 生命周期钩子数组（setup 执行期间注册） */
  mounted: (() => void)[]
  updated: (() => void)[]
  beforeUnmount: (() => void)[]
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
    render: null as unknown as () => any,
    subTree: null,
    update: () => {},
    unmount: () => {},
    isMounted: false,
    container: container as Element | null,
    mounted: [],
    updated: [],
    beforeUnmount: [],
  }
  vnode.component = instance

  // setup 执行期间挂载 currentInstance 上下文：
  // 组件内调用 onMounted / onUpdated / onBeforeUnmount 注册到本实例
  setCurrentInstance(instance)
  instance.render = options.__setup(props)
  setCurrentInstance(null)

  // 更新函数：重新 render 并与旧子树 patch
  const update = () => {
    const newSubTree = instance.render()
    const oldSubTree = instance.subTree
    instance.subTree = newSubTree
    patch(oldSubTree, newSubTree, container as Element)
    // 刷新组件 VNode 的 el（子树根可能因条件渲染而改变）
    vnode.el = instance.subTree ? instance.subTree.el : null
    // 钩子：首次渲染后进入 mounted 态，之后每次重渲染触发 updated
    if (instance.isMounted) {
      instance.updated.forEach((fn) => fn())
    } else {
      instance.isMounted = true
    }
  }

  // runEffect 立即执行首次挂载（同步渲染）；之后响应式变化经 scheduler
  // 入微任务队列去重批量更新（调度批处理）
  const effect = runEffect(update, { scheduler: queueJob })

  // 首次渲染已完成（DOM 已挂载）→ 触发 onMounted
  // 注意：子组件的 mounted 先于父组件触发（同步挂载顺序，与 Vue 3 相反）
  instance.mounted.forEach((fn) => fn())

  // props 更新路径（父组件 patchComponent 手动调度）同样入队，
  // 获得 cleanup + 正确 activeEffect 上下文 + 批处理语义；
  // 裸调用 update 会把调用方（父 effect）误收集进本组件的内部响应式依赖
  instance.update = () => {
    if (effect.active) queueJob(effect)
  }

  instance.unmount = () => {
    instance.beforeUnmount.forEach((fn) => fn())
    effect.stop()
  }

  // 组件 VNode 的 el 指向其子树根节点
  vnode.el = instance.subTree ? instance.subTree.el : null
}
