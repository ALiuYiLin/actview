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
} from '../reactivity/reactive-system'
import { setCurrentInstance } from './lifecycle'
import { getErrorBoundary } from './errorBoundary'
import { EffectScope } from '../reactivity/effectScope'
import type { VNode } from '../vnode'

/**
 * renderer 注入的渲染依赖（消除 renderer ↔ mountComponent 循环依赖）：
 * mountComponent 不 import './renderer'，改由 renderer 挂载组件时传入自身
 * 的 patch / applyRef。ESM 环 → 单向依赖（renderer → mountComponent）。
 */
export interface RendererDeps {
  /** 子树 patch（组件 update 时与旧子树 diff） */
  patch: (
    oldVnode: any,
    newVnode: any,
    container: Element,
    index?: number,
    parent?: any
  ) => void
  /** 模板引用回调（ref 指向组件实例） */
  applyRef: (ref: any, value: any) => void
}

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
  /** attrs：props 白名单外的属性（fallthrough 用），同样增量更新 */
  attrs: any
  /** 父组件实例（provide/inject 链） */
  parent: ComponentInstance | null
  /** 注入表：未调用 provide 时共享父引用（零拷贝）；首次 provide 时 copy-on-write */
  injects: Record<string, any>
  render: () => VNode
  subTree: VNode | null
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

/** 挂载组件 VNode：实例化并建立响应式更新 effect（deps 由 renderer 注入） */
export function mountComponent(
  vnode: any,
  container: Element | null,
  parentInstance: ComponentInstance | null | undefined,
  deps: RendererDeps
) {
  const options = vnode.type
  if (
    options == null ||
    typeof options !== 'object' ||
    typeof options.__setup !== 'function'
  ) {
    throw new Error('[actview] mountComponent: 无效的组件，缺少 __setup')
  }

  // props 为普通对象：父组件通过 patchComponent 更新值 + 手动 update()。
  // 阶段 2：按组件声明的 __props 白名单拆分为 setup props 与 attrs
  //   - 有声明：声明内 → setup(props)，声明外（class/data-*/on* 等）→ ctx.attrs
  //   - 无声明（函数形态）：props 全量（兼容现有 setup 读取），attrs 同全量（fallthrough 用）
  const { props, attrs } = splitProps(options.__props, vnode.props)

  const instance: ComponentInstance = {
    setup: options.__setup,
    props,
    attrs,
    parent: parentInstance ?? null,
    injects: parentInstance?.injects ?? {},
    render: null as unknown as () => VNode,
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
  deps.applyRef(vnode.props?.ref, instance)

  // setup 执行期间挂载 currentInstance 上下文：
  // 组件内调用 onMounted / onUpdated / onBeforeUnmount / provide 均注册到本实例
  setCurrentInstance(instance)
  instance.render = options.__setup(props, {
    attrs,
    // live getter：provide 拷贝后 ctx.injects 实时指向最新注入表
    // （若传快照引用，组件自己 provide 后再读 ctx.injects 会拿到旧表）
    get injects() {
      return instance.injects
    }
  })
  setCurrentInstance(null)

  // 更新函数：重新 render 并与旧子树 patch
  const update = () => {
    try {
      const newSubTree0 = instance.render()
      let newSubTree: any = newSubTree0
      // attribute fallthrough：外部传入的 attrs（非 props 声明属性）合并到单根元素
      // 的 props（class 拼接、其余根元素显式声明优先；Fragment 多根不透传）。
      // inheritAttrs: false 时跳过自动合并（attrs 仍在 ctx.attrs 供显式绑定）
      if (options.__inheritAttrs !== false) {
        newSubTree = mergeAttrsToRoot(newSubTree, attrs)
      }
      const oldSubTree = instance.subTree
      instance.subTree = newSubTree
      // 子树 children 的父实例 = 本组件实例（子组件 provide/inject 继承来源）
      deps.patch(oldSubTree, newSubTree, container as Element, undefined, instance)
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
/** 事件透传：onXxx（含 onClickCapture、小写 onclick）；on 后须为字母 */
function isEventKey(key: string): boolean {
  return key.length > 2 && /^on[A-Za-z]/.test(key)
}

/**
 * 值类型过滤：仅「能安全 setAttribute 的值」参与透传
 *   - string / number / boolean ✓（直接 setAttribute）
 *   - style 对象 ✓（浅合并进根元素）
 *   - on* 事件函数 ✓（绑定到根元素）
 *   - 其余对象 / 数组 / 函数 ✗（避免 setAttribute("[object Object]") 污染根元素，
 *     与 Vue 的差异点：Vue 对所有未声明 prop 落根，这里仅保护对象/数组）
 */
function isPassThroughValue(key: string, value: any): boolean {
  const t = typeof value
  if (t === 'string' || t === 'number' || t === 'boolean') return true
  // style：仅普通对象（数组排除；字符串已在上面返回 true）
  if (key === 'style') {
    return t === 'object' && !Array.isArray(value)
  }
  if (t === 'function' && isEventKey(key)) return true
  return false
}

/**
 * 收集 attrs：组件声明的 __props 白名单外的属性。
 *   - 有声明：声明外的 key（class、data-*、aria-*、on* 等）→ attrs
 *   - 无声明（函数形态）：全部（除内部字段 key/ref/children/slots）→ attrs
 */
export function collectAttrs(
  declared: readonly string[] | undefined,
  vnodeProps: any
): any {
  const all = vnodeProps || {}
  const attrs: any = {}
  const hasDeclared = !!declared && declared.length > 0
  for (const key in all) {
    if (key === 'key' || key === 'ref') continue
    if (isInternalAttrKey(key)) continue
    if (!hasDeclared || !declared.includes(key)) attrs[key] = all[key]
  }
  return attrs
}

/**
 * 按组件声明的 __props 白名单拆分 vnode.props 为 setup props 与 attrs。
 *   - 无声明（函数形态）：props 全量（兼容现有 setup(props) 读取全量外部属性），
 *     attrs 同全量（fallthrough 用）
 *   - 有声明（options 形态）：声明内 → props（+ children/slots 内部字段），
 *     声明外 → attrs
 */
function splitProps(
  declared: readonly string[] | undefined,
  vnodeProps: any
): { props: any; attrs: any } {
  const all = vnodeProps || {}
  const props: any = {}
  const hasDeclared = !!declared && declared.length > 0
  for (const key in all) {
    if (key === 'key' || key === 'ref') continue
    if (isInternalAttrKey(key)) {
      props[key] = all[key]
      continue
    }
    if (!hasDeclared || declared.includes(key)) props[key] = all[key]
  }
  return { props, attrs: collectAttrs(declared, vnodeProps) }
}

/**
 * 把外部传入 attrs（组件未声明为 props 的属性）合并到根 vnode 的 props。
 * 阶段 2（对齐 Vue 完整语义，全量透传）：
 *   - 仅单根生效：Fragment（多根）不透传（对齐 Vue，需显式 {...attrs}）
 *   - attrs 全量透传（不再白名单），值类型过滤见 isPassThroughValue
 *   - class：拼接合并（组件自带 + 外部共存）
 *   - style：对象浅合并（根已有 style 时不覆盖）
 *   - 事件 on*：根元素已有 → 跳过（显式优先，阶段 2 保留；Vue invoker 并存列后续）
 *   - 其余（id、data-*、aria-* 等）：根元素显式声明优先
 *   - data-v-*（scoped hash）：在 attrs 中 → 落子组件根元素，实现
 *     「子 root 继承父 scopeId」；多级嵌套经组件 props 链逐级累积
 * vnode 是每次 render 新建的，直接克隆 props 替换安全（不污染复用节点）。
 */
export function mergeAttrsToRoot(subTree: any, attrs: any) {
  if (subTree == null) return subTree
  // Fragment 多根：不自动 fallthrough（Vue 同款，需显式 {...attrs} 绑定）
  if (subTree.type === FragmentTag) return subTree
  // 内置组件（Teleport/Transition）：props 有特殊语义，不透传
  if (subTree.type?.__builtin) return subTree
  if (!attrs) return subTree

  // 快速判断：无实际可透传的 attrs（全内部 key / 非透传值 / 空对象）→ 不 merge，
  // 保持 hoisted 静态子树的编译期优化
  let hasPassable = false
  for (const key of Object.keys(attrs)) {
    if (isInternalAttrKey(key)) continue
    const value = attrs[key]
    if (!isPassThroughValue(key, value)) continue
    if (value == null || value === false) continue
    hasPassable = true
    break
  }
  if (!hasPassable) return subTree

  // hoisted/静态子树（__patchFlag !== undefined）是模块级共享对象：
  // 1) clone 后再 merge，避免污染共享对象（跨实例/下次渲染复用）
  // 2) 记录首次的源码 props（__baseProps），每次从源码态合并——否则 class 等
  //    attrs 会在被污染的基础上累积（'body a' + 'b' → 'body a b' 而非 'body b'）
  if (subTree.__patchFlag !== undefined) {
    subTree.__baseProps ??= { ...(subTree.props || {}) }
    subTree = { ...subTree, props: { ...subTree.__baseProps } }
  }

  const rootProps = { ...(subTree.props || {}) }
  for (const key of Object.keys(attrs)) {
    if (isInternalAttrKey(key)) continue
    const value = attrs[key]
    // 值类型过滤：非标量且非 style/事件的 attrs 不透传
    if (!isPassThroughValue(key, value)) continue
    if (value == null || value === false) continue

    if (key === 'class' || key === 'className') {
      // class 合并：根元素已有 + 外部，统一落到 class
      const existing = rootProps.class ?? rootProps.className ?? ''
      const combined = [existing, value].filter(Boolean).join(' ')
      rootProps.class = combined
      delete rootProps.className
      continue
    }
    if (key === 'style' && rootProps.style != null) {
      // style 合并：根已有 style 时才浅合并；根为字符串 style 时显式优先
      // （不合并对象，避免字符串被静默丢弃）
      if (
        typeof rootProps.style === 'object' &&
        !Array.isArray(rootProps.style) &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        rootProps.style = { ...rootProps.style, ...value }
      }
      continue
    }
    // 其余（id/data-*/aria-*/on* 等）：根元素显式声明优先
    if (!(key in rootProps)) rootProps[key] = value
  }
  subTree.props = rootProps
  // attrs 是运行时合并进根元素 props 的（编译期静态标记不可预见）：
  // 清除 __patchFlag 降级老路径，避免"静态 props 跳过 patch"吞掉 attrs 更新
  subTree.__patchFlag = undefined
  return subTree
}

