// ============================================================
// 组件挂载 — 用户思路的核心
//   const render = __setup(props)      // props 为普通对象
//   runEffect(() => {
//     const newVnode = render()
//     patch(oldVnode, newVnode)   // 响应式变化时自动执行
//   })
// ============================================================

import {
  runEffect,
  queueJob,
  pauseTracking,
  resetTracking
} from './reactive-system'
import { patch, applyRef } from './renderer'
import { setCurrentInstance } from './lifecycle'
import { getErrorBoundary } from './errorBoundary'
import { EffectScope } from './effectScope'

/**
 * 触发生命周期钩子：暂停依赖收集。
 * 钩子在组件 effect 的 run 上下文内同步执行，若钩子里读写响应式
 * （如 onUpdated 里 count++），`++` 的读会把该响应式 track 进组件渲染 effect，
 * 写时触发自身 =》 无限循环。Vue 3 的钩子在 post 队列执行（activeEffect 为 null）
 * 天然无此问题 —— 这里用 pauseTracking 对齐该语义。
 */
function invokeHooks(hooks: (() => void)[]) {
  if (!hooks.length) return
  pauseTracking()
  try {
    hooks.forEach((fn) => fn())
  } finally {
    resetTracking()
  }
}

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
  /** 实例 effect 是否仍存活（被卸载后 false；缓存复用判断用） */
  isActive: () => boolean
  /** 组件 effect scope：setup 期间的 watch/computed/render effect 注册于此，卸载时统一停止 */
  scope: EffectScope
  /** 生命周期钩子数组（setup 执行期间注册） */
  mounted: (() => void)[]
  updated: (() => void)[]
  beforeUnmount: (() => void)[]
  unmounted: (() => void)[]
}

/** 挂载组件 VNode：实例化并建立响应式更新 effect */
export function mountComponent(vnode: any, container: Element | null) {
  const options = vnode.type
  if (
    options == null ||
    typeof options !== 'object' ||
    typeof options.__setup !== 'function'
  ) {
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
    isActive: () => false,
    scope: new EffectScope(),
    mounted: [],
    updated: [],
    beforeUnmount: [],
    unmounted: []
  }
  vnode.component = instance

  // 组件模板引用：ref 指向组件实例
  applyRef(vnode.props?.ref, instance)

  // setup 执行期间挂载 currentInstance 上下文：
  // 组件内调用 onMounted / onUpdated / onBeforeUnmount 注册到本实例
  setCurrentInstance(instance)
  const setupResult = options.__setup(props)
  setCurrentInstance(null)
  // __setup 返回形态归一化 → render 函数：
  //   函数        =》 渲染函数（原样）
  //   组件对象    =》 () => 组件 vnode（嵌套组件：__setup 返回 defineComponent）
  //   vnode       =》 () => vnode
  //   其他        =》 () => null
  instance.render = normalizeSetupResult(setupResult)

  // 更新函数：重新 render 并与旧子树 patch
  const update = () => {
    try {
      const newSubTree = instance.render()
      // attribute fallthrough：外部传入的非内部属性（attrs）合并到单根元素的
      // props（class 拼接、其余根元素显式声明优先；Fragment 多根不透传）
      mergeAttrsToRoot(newSubTree, props)
      const oldSubTree = instance.subTree
      instance.subTree = newSubTree
      patch(oldSubTree, newSubTree, container as Element)
      // 刷新组件 VNode 的 el（子树根可能因条件渲染而改变）
      vnode.el = instance.subTree ? instance.subTree.el : null
      // 钩子：首次渲染后进入 mounted 态，之后每次重渲染触发 updated
      if (instance.isMounted) {
        invokeHooks(instance.updated)
      } else {
        instance.isMounted = true
      }
    } catch (err) {
      // 渲染错误：交给最近的 ErrorBoundary（显示 fallback）
      const boundary = getErrorBoundary()
      if (boundary && boundary.errorRef?.value == null) {
        boundary.errorRef.value = err
        boundary.update?.()
      } else {
        console.error('[actview] 组件渲染错误:', err)
      }
    }
  }

  // runEffect 立即执行首次挂载（同步渲染）；之后响应式变化经 scheduler
  // 入微任务队列去重批量更新（调度批处理）
  // render effect 注册进组件 scope，随组件卸载自动停止
  const effect = instance.scope.run(() =>
    runEffect(update, { scheduler: queueJob })
  )

  // 首次渲染已完成（DOM 已挂载）→ 触发 onMounted
  // 注意：子组件的 mounted 先于父组件触发（同步挂载顺序，与 Vue 3 相反）
  invokeHooks(instance.mounted)

  // props 更新路径（父组件 patchComponent 手动调度）同样入队，
  // 获得 cleanup + 正确 activeEffect 上下文 + 批处理语义；
  // 裸调用 update 会把调用方（父 effect）误收集进本组件的内部响应式依赖
  instance.update = () => {
    if (effect.active) queueJob(effect)
  }

  instance.isActive = () => effect.active

  instance.unmount = () => {
    invokeHooks(instance.beforeUnmount)
    // 停止组件作用域内全部 effect（render effect + setup 期间的 watch/computed）
    instance.scope.stop()
    effect.stop() // 兜底（scope.stop 已含 render effect，幂等）
    // unmounted：卸载完成后触发（Vue 3 语义：在 beforeUnmount 之后）
    invokeHooks(instance.unmounted)
  }

  // 组件 VNode 的 el 指向其子树根节点
  vnode.el = instance.subTree ? instance.subTree.el : null
}

// ============================================================
// Attribute Fallthrough（阶段 1：全量透传）
//   外部传入组件但组件未在根元素显式使用的属性（attrs）自动合并到
//   单根元素 props，解决 `<Content class="vp-doc" />` 丢 class 问题。
//   详见 docs/attr-fallthrough.md
// ============================================================

const FragmentTag = Symbol.for('react.fragment')

/**
 * __setup 返回形态归一化 → render 函数（嵌套组件支持）。
 * Babel 插件把 setup 风格的渲染函数包成 defineComponent（嵌套组件）后，
 * __setup 返回的是组件对象而非函数——这里统一处理。
 */
function normalizeSetupResult(result: any): () => any {
  if (typeof result === 'function') return result
  if (result != null && typeof result === 'object') {
    // 组件对象（defineComponent 产物）：包成组件 vnode 渲染（嵌套组件）
    if (typeof result.__setup === 'function') {
      return () => ({
        $$typeof: Symbol.for('react.element'),
        type: result,
        key: null,
        ref: null,
        props: {},
      })
    }
    // vnode：直接渲染
    if (result.$$typeof) return () => result
  }
  return () => null
}

/** 是否忽略该 key（内部字段，不参与 fallthrough） */
function isInternalAttrKey(key: string): boolean {
  return key === 'key' || key === 'ref' || key === 'children' || key === 'slots'
}

/**
 * 把外部传入 props 中「根元素未声明」的属性合并到根 vnode 的 props。
 * 规则（对齐 Vue 单根语义）：
 *   - 仅单根生效：Fragment（多根）不透传
 *   - class：拼接合并（组件自带 + 外部共存）
 *   - style：根元素显式声明优先（阶段 1 简化，不做对象深合并）
 *   - 事件 on*：根元素已有 → 跳过（显式优先）；没有 → 透传自动绑定
 *   - 其余：根元素显式声明优先
 * vnode 是每次 render 新建的，直接克隆 props 替换安全（不污染复用节点）。
 */
/** 白名单：允许透传到根元素的 attrs（Vue 语义：非 prop 的 class/style/id/事件）
 *  业务 props（如 features/items 等组件自定义 prop）不透传，避免
 *  setAttribute(String(数组/对象)) =》 "[object Array]" 污染根元素 */
const FALLTHROUGH_KEYS = new Set(['class', 'className', 'style', 'id'])

/** 事件透传：onXxx（含 onClickCapture、小写 onclick）；on 后须为字母 */
function isEventKey(key: string): boolean {
  return key.length > 2 && /^on[A-Za-z]/.test(key)
}

/**
 * 把外部传入 props 中「白名单内的 attrs」合并到根 vnode 的 props。
 * 规则（对齐 Vue 单根语义 + 白名单）：
 *   - 仅单根生效：Fragment（多根）不透传
 *   - 白名单：class/className/style/id + on* 事件；其余 key（业务 props、
 *     以及 data- / aria- 前缀等）一律不透传
 *   - class：拼接合并（组件自带 + 外部共存）
 *   - style：对象合并（根已有 style 时 {...root, ...attrs}，不覆盖）
 *   - 事件 on*：根元素已有 → 跳过（显式优先）；没有 → 透传自动绑定
 *   - 其余：根元素显式声明优先
 * vnode 是每次 render 新建的，直接克隆 props 替换安全（不污染复用节点）。
 */
export function mergeAttrsToRoot(subTree: any, props: any) {
  if (subTree == null) return
  // Fragment 多根：不自动 fallthrough（Vue 同款，需显式 {...attrs} 绑定）
  if (subTree.type === FragmentTag) return
  // 内置组件（Teleport/Transition）：props 有特殊语义，不透传
  if (subTree.type?.__builtin) return
  if (!props) return

  const rootProps = { ...(subTree.props || {}) }
  for (const key of Object.keys(props)) {
    if (isInternalAttrKey(key)) continue
    // 白名单过滤：非 class/style/id/on* 的业务 props 不透传
    if (!FALLTHROUGH_KEYS.has(key) && !isEventKey(key)) continue
    const value = props[key]
    if (value == null || value === false) continue

    if (key === 'class' || key === 'className') {
      // class 合并：根元素已有 + 外部，统一落到 class
      const existing = rootProps.class ?? rootProps.className ?? ''
      const combined = [existing, value].filter(Boolean).join(' ')
      rootProps.class = combined
      delete rootProps.className
      continue
    }
    if (key === 'style' && rootProps.style) {
      // style 对象合并：根已有 style 时深一层浅合并，不覆盖
      const base = typeof rootProps.style === 'object' ? rootProps.style : {}
      rootProps.style = { ...base, ...value }
      continue
    }
    // 其余（id/on* 等）：根元素显式声明优先
    if (!(key in rootProps)) rootProps[key] = value
  }
  subTree.props = rootProps
}

