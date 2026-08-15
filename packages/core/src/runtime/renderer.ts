// ============================================================
// 渲染器 — VNode → 真实 DOM
//   patch(oldVnode, newVnode, container)
//   oldVnode 为 null → 挂载；type/key 相同 → 更新；否则替换
// ============================================================

import { mountComponent, invokeHooks } from './mountComponent'
import { SCOPED_ID_PROP, splitScopedId, extractScopedIdProps } from './scopedProps'
import { mountSolid, unmountSolid, SOLID_TYPE } from './solid'
import { pauseTracking, resetTracking } from '../reactivity/reactive-system'
import {
  mountTeleport,
  patchTeleport,
  unmountTeleport,
  mountTransition,
  patchTransition,
  unmountTransition,
  playLeave,
  bindPatchChildren
} from './transition'

const REACT_ELEMENT_TYPE = Symbol.for('react.element')
const Fragment = Symbol.for('react.fragment')
const Text = Symbol.for('react.text')

// ------------------------------------------------------------
// SVG 命名空间 — createElementNS 渲染 SVG 元素
// ------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg'

const SVG_TAGS = new Set(
  (
    'svg,animate,animateMotion,animateTransform,circle,clipPath,defs,desc,' +
    'ellipse,feBlend,feColorMatrix,feComponentTransfer,feComposite,feConvolveMatrix,' +
    'feDiffuseLighting,feDisplacementMap,feDistantLight,feDropShadow,feFlood,feFuncA,' +
    'feFuncB,feFuncG,feFuncR,feGaussianBlur,feImage,feMerge,feMergeNode,feMorphology,' +
    'feOffset,fePointLight,feSpecularLighting,feSpotLight,feTile,feTurbulence,filter,' +
    'foreignObject,g,image,line,linearGradient,marker,mask,metadata,mpath,path,pattern,' +
    'polygon,polyline,radialGradient,rect,set,stop,symbol,switch,text,textPath,tspan,' +
    'use,view'
  ).split(',')
)

/** 按标签创建元素：SVG 元素走 createElementNS，其余 createElement */
function createElement(tag: string): Element {
  return SVG_TAGS.has(tag)
    ? document.createElementNS(SVG_NS, tag)
    : document.createElement(tag)
}

function createTextVNode(text: string) {
  return {
    $$typeof: REACT_ELEMENT_TYPE,
    type: Text,
    key: null,
    ref: null,
    props: { text }
  }
}

/** 组件 VNode：type 是 { __setup } 对象 */
export function isComponentVNode(vnode: any): boolean {
  return (
    vnode != null &&
    typeof vnode === 'object' &&
    vnode.type != null &&
    typeof vnode.type === 'object' &&
    '__setup' in vnode.type
  )
}

/** 将文本/数字子节点包装为文本 VNode，其余原样返回 */
function toVNode(child: any): any {
  if (child == null || typeof child === 'boolean') return null
  if (typeof child === 'string' || typeof child === 'number') {
    return createTextVNode(String(child))
  }
  return child
}

function normalizeChildren(children: any): any[] {
  if (children == null || children === false || children === true) return []
  // 扁平化嵌套数组：JSX children 可以是 `[el, arr.map(...)]`（数组含数组），
  // 不扁平化会把子数组当成单个 child → mountVNode(数组) → createElement(数组)
  // → 渲染出 <undefined> 元素（vitepress nav.map 场景）
  return Array.isArray(children) ? children.flat(Infinity) : [children]
}

// ------------------------------------------------------------
// patch 入口
// ------------------------------------------------------------

/** 动态组件：type === 'component'（`<component is={...} />`）时解析 props.is 为真实类型 */
function resolveDynamicVNode(vnode: any): any {
  if (vnode && vnode.type === 'component') {
    const is = vnode.props?.is
    vnode.type =
      is && typeof is === 'object' ? is : typeof is === 'string' ? is : 'div'
  }
  return vnode
}

/**
 * patch 入口。parent 为父组件实例（provide/inject 继承来源）；
 * 由组件 update() 传入自身实例，沿挂载链传递到子组件 mountComponent。
 */
export function patch(
  oldVnode: any,
  newVnode: any,
  container: Element,
  index?: number,
  parent?: any
) {
  newVnode = resolveDynamicVNode(newVnode)
  if (oldVnode == null) {
    mountVNode(newVnode, container, parent)
    return
  }
  if (newVnode == null) {
    unmount(oldVnode)
    return
  }
  // 同一对象短路：组件未重渲染时缓存 subTree 被当 newVnode 继续 patch（自我
  // patch）。若不短路，keyed diff 会对同一 vnode 执行 mount+unmount，
  // mountVNode 无条件重建覆盖 vnode.el =》 旧 DOM 残留累积（语言切换 .title +1）
  if (oldVnode === newVnode) return
  // type 与 key 都相同 → 走更新；否则整体替换
  if (oldVnode.type === newVnode.type && oldVnode.key === newVnode.key) {
    patchVNode(oldVnode, newVnode, container, index, parent)
  } else if (newVnode.component?.isActive?.()) {
    // keep-alive 缓存命中：旧组件先卸载（走缓存分支，DOM 移入隐藏容器），
    // 再复用缓存实例更新；实例已失效（如 Suspense 的 fallback 替换后）则重建
    unmount(oldVnode, container, index)
    patchComponent(oldVnode, newVnode, container, parent)
  } else {
    replace(oldVnode, newVnode, container, index, parent)
  }
}

export function render(vnode: any, container: Element) {
  patch(null, vnode, container)
}

// 模块评估完成后注入 patchChildren（transition 模块不 import 本模块，
// 避免循环依赖；此调用在函数声明全部就绪后执行）
bindPatchChildren(patchChildren)

// ------------------------------------------------------------
// 挂载
// ------------------------------------------------------------

/** 模板引用：vnode.props.ref（函数或 { value }）在挂载/卸载时回调 */
export function applyRef(ref: any, value: any) {
  if (!ref) return
  if (typeof ref === 'function') ref(value)
  else if (ref && typeof ref === 'object') ref.value = value
}

export function mountVNode(vnode: any, container: Element | null, parent?: any): any {
  vnode = resolveDynamicVNode(vnode)
  if (vnode == null || typeof vnode === 'boolean') return null

  // <solid> 块：内部由 effect 自驱动（黑盒 DOM 子树），只负责插入
  if (vnode.$$typeof === SOLID_TYPE) {
    return mountSolid(vnode, container)
  }

  // 内置组件（Teleport / Transition）：优先于普通组件分支
  // 用 __builtin 标记判断（跨模块实例引用相等不可靠）
  if (vnode.type?.__builtin === 'teleport')
    return mountTeleport(vnode, container, parent)
  if (vnode.type?.__builtin === 'transition')
    return mountTransition(vnode, container, parent)

  // 组件
  if (isComponentVNode(vnode)) {
    // 注入渲染依赖（patch/applyRef）→ 组件挂载不反向 import 本模块
    mountComponent(vnode, container, parent, { patch, applyRef })
    return vnode.el
  }
  // Fragment：自身无 DOM，直接挂载 children
  if (vnode.type === Fragment) {
    vnode.el = null
    vnode.__avChildren = patchChildren(
      null,
      vnode.props?.children,
      container as Element,
      undefined,
      parent
    )
    return null
  }
  // 文本
  if (vnode.type === Text) {
    // 空文本不创建节点（避免残留空文本节点），下次非空时在 patch 中创建
    if (vnode.props.text === '') {
      vnode.el = null
      return null
    }
    const el = document.createTextNode(vnode.props.text)
    vnode.el = el
    container?.appendChild(el)
    return el
  }
  // 原生元素
  const el = createElement(vnode.type as string)
  vnode.el = el
  patchProps(null, vnode.props, el)
  // dangerouslySetInnerHTML：直接注入 HTML，忽略 children（React 语义）
  const hasDanger = vnode.props?.dangerouslySetInnerHTML != null
  vnode.__avChildren = hasDanger
    ? []
    : patchChildren(null, vnode.props?.children, el, undefined, parent)
  container?.appendChild(el)
  // 模板引用：ref 指向挂载后的 DOM
  applyRef(vnode.props?.ref, el)
  return el
}

// ------------------------------------------------------------
// 更新
// ------------------------------------------------------------

/** v-memo deps 比较：长度一致 + 逐项 Object.is（值比较，非引用比较） */
function sameMemoDeps(a: any, b: any): boolean {
  if (a === b) return true
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false
  }
  return true
}

function patchVNode(
  oldVnode: any,
  newVnode: any,
  container: Element,
  index?: number,
  parent?: any
) {
  // <solid> 块：内部自驱动，新旧始终短路（DOM/订阅不变，el 继承供 keyed 移动）
  if (newVnode.$$typeof === SOLID_TYPE) {
    newVnode.el = oldVnode?.el ?? newVnode.__el ?? null
    newVnode.__scope = oldVnode?.__scope ?? newVnode.__scope
    newVnode.__el = oldVnode?.__el ?? newVnode.__el
    return
  }
  // v-memo（esbuild 产物经 jsxFactory 提取）：deps 与上次相同 → 整棵子树短路，
  // 不 diff / 不碰 DOM。DOM 归属（el/__avChildren）从旧 vnode 继承。
  if (newVnode.__memoDeps) {
    if (
      oldVnode &&
      oldVnode.__memoValue !== undefined &&
      sameMemoDeps(newVnode.__memoValue, oldVnode.__memoValue)
    ) {
      newVnode.el = oldVnode.el
      newVnode.__avChildren = oldVnode.__avChildren
      return
    }
  }

  // 内置组件（Teleport / Transition）
  if (newVnode.type?.__builtin === 'teleport') {
    patchTeleport(oldVnode, newVnode, container, parent)
    return
  }
  if (newVnode.type?.__builtin === 'transition') {
    patchTransition(oldVnode, newVnode, container, parent)
    return
  }
  // 组件
  if (isComponentVNode(newVnode)) {
    patchComponent(oldVnode, newVnode, container, parent)
    return
  }
  // 文本：每次 render 生成的文本 VNode 是新的（无 el），
  // 优先用旧 vnode 的 el（vnode 级缓存），否则按索引从 container.childNodes 恢复
  if (newVnode.type === Text) {
    // 空文本：移除旧节点（若存在）并置 el=null，下次非空时重建 —— 不残留空文本节点
    if (newVnode.props.text === '') {
      if (oldVnode.el && oldVnode.el.parentNode) {
        oldVnode.el.parentNode.removeChild(oldVnode.el)
      }
      newVnode.el = null
      return
    }
    let el = oldVnode.el
    if (!el) {
      // 上次是空文本（已移除）或新增：创建文本节点，插入到 index 位置（childNodes[index] 前）
      el = document.createTextNode(newVnode.props.text)
      newVnode.el = el
      const anchor =
        index != null ? (container.childNodes[index] ?? null) : null
      container.insertBefore(el, anchor)
    } else {
      newVnode.el = el
    }
    if (el.textContent !== newVnode.props.text) {
      el.textContent = newVnode.props.text
    }
    return
  }
  // Fragment
  if (newVnode.type === Fragment) {
    newVnode.el = oldVnode.el
    newVnode.__avChildren = patchChildren(
      oldVnode.props?.children,
      newVnode.props?.children,
      container,
      oldVnode,
      parent
    )
    return
  }
  // 原生元素：更新 props 与 children
  const el = (newVnode.el = oldVnode.el as Element)
  // props 引用相同（编译期 hoist 的静态 props）→ 整体跳过属性 patch
  if (oldVnode.props !== newVnode.props) {
    patchProps(oldVnode.props, newVnode.props, el)
  }
  // dangerouslySetInnerHTML：忽略 children
  const hasDanger = newVnode.props?.dangerouslySetInnerHTML != null
  newVnode.__avChildren = patchChildren(
    hasDanger ? undefined : oldVnode.props?.children,
    hasDanger ? undefined : newVnode.props?.children,
    el,
    oldVnode,
    parent
  )
}

/** 组件更新：props 未变则复用旧实例；变了则更新 props（shallowReactive 代理，
 *  写入自动触发读取该 prop 的 computed/watch/render effect），并手动触发
 *  子组件 update() 作为双保险（jobQueue Set 去重，不会双渲染），
 *  完成精确更新（不再整组件卸载重挂）。 */
function patchComponent(
  oldVnode: any,
  newVnode: any,
  container: Element,
  parent?: any
) {
  // keep-alive 缓存复用：newVnode 已带自己的实例（缓存实例）→ 优先使用；
  // 普通组件更新：newVnode 无实例 → 沿用旧 vnode 的实例
  const instance = newVnode.component ?? oldVnode.component
  if (!instance) {
    // 异常情况：旧节点没有实例，直接重挂
    mountComponent(newVnode, container, parent, { patch, applyRef })
    return
  }

  // 组件边界 scoped 转换（更新路径）：每次父渲染产出的 props 都重新带注入的
  // data-v-*（值为 ''），原地提取合并为 scopedId prop 后再与实例 props 比较/写入
  extractScopedIdProps(newVnode.props)

  if (!isSameProps(oldVnode.props, newVnode.props)) {
    // 增量更新 props（key/ref 除外），有变化触发子组件更新
    if (updateProps(instance.props, newVnode.props)) {
      instance.update()
    }
  }

  newVnode.component = instance
  newVnode.el = instance.subTree ? instance.subTree.el : oldVnode.el
}

/**
 * 把新 props 增量写入旧 props（跳过 key/ref），返回是否有变化。
 * props 是 shallowReactive 代理：读写期间必须 pauseTracking——
 * 本函数在父组件渲染 effect 上下文中执行，若读取代理触发 track，
 * 父 effect 会被污染性地订阅到子组件 props（子 props 写入 → 父重渲染
 * → 又写子 props → 自激死循环）。写入的 trigger 不受 pauseTracking 影响。
 */
export function updateProps(oldProps: any, newProps: any): boolean {
  newProps = newProps || {}
  let changed = false
  pauseTracking()
  try {
    for (const key in newProps) {
      if (key === 'key' || key === 'ref') continue
      if (!Object.is(oldProps[key], newProps[key])) {
        oldProps[key] = newProps[key]
        changed = true
      }
    }
    // 移除父组件不再传递的 props
    for (const key in oldProps) {
      if (key === 'key' || key === 'ref') continue
      if (!(key in newProps)) {
        delete oldProps[key]
        changed = true
      }
    }
  } finally {
    resetTracking()
  }
  return changed
}

function isSameProps(a: any, b: any): boolean {
  a = a || {}
  b = b || {}
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((k) => Object.is(a[k], b[k]))
}

// ------------------------------------------------------------
// children 与 props
// ------------------------------------------------------------

function patchChildren(
  oldChildren: any,
  newChildren: any,
  container: Element,
  oldVnode?: any,
  parent?: any
): any[] {
  // 旧 vnode 列表：优先用上次 diff 缓存的 vnode（带 el，文本节点可精确定位），
  // 否则对旧 children 重新包装（首次/异常兜底）
  const oldList =
    oldVnode?.__avChildren ?? normalizeChildren(oldChildren).map(toVNode)

  // 引用相同短路：children 数组未重建（编译期 hoist 的静态 children），
  // 子树结构必然未变 → 跳过整个 diff，直接复用上次缓存的 vnode 列表
  if (oldChildren === newChildren && oldVnode?.__avChildren) {
    return oldVnode.__avChildren
  }

  const newList = normalizeChildren(newChildren).map(toVNode)

  // 新列表中出现 key → 走 keyed diff；否则保持同索引 diff
  if (newList.some((v) => v && v.key != null)) {
    patchKeyedChildren(oldList, newList, container, parent)
    return newList
  }

  const len = Math.max(oldList.length, newList.length)
  for (let i = 0; i < len; i++) {
    patch(oldList[i] ?? null, newList[i] ?? null, container, i, parent)
  }
  return newList
}

// ------------------------------------------------------------
// keyed diff — 按 key 复用，LIS 最小移动（参考 Vue 3 思路）
//   1. 建旧 key → index 映射
//   2. 遍历新列表：key 命中 → patch 复用并记录旧 index（source，+1 偏移）；
//      未命中 → 创建（暂不挂载），source 记 0
//   3. 卸载未被复用的旧节点（此时 DOM 仍是旧顺序，文本可按索引恢复）
//   4. 对 source 求最长递增子序列（LIS）—— 这些节点保持原位，不移动
//   5. 从后往前：新节点与非 LIS 节点 insertBefore 到 anchor 前，LIS 节点不动
// ------------------------------------------------------------

function patchKeyedChildren(
  oldList: any[],
  newList: any[],
  container: Element,
  parent?: any
) {
  const oldKeyToIndex = new Map<any, number>()
  oldList.forEach((vnode, i) => {
    if (vnode && vnode.key != null) oldKeyToIndex.set(vnode.key, i)
  })

  const newLen = newList.length
  // source[i]：新列表第 i 项对应旧列表下标 +1；0 = 新创建节点
  const source = new Array(newLen).fill(0)

  // 2. 复用或创建
  for (let i = 0; i < newLen; i++) {
    const newVNode = newList[i]
    if (newVNode == null) continue
    if (newVNode.key != null && oldKeyToIndex.has(newVNode.key)) {
      const oldIndex = oldKeyToIndex.get(newVNode.key)!
      patch(oldList[oldIndex], newVNode, container, undefined, parent)
      source[i] = oldIndex + 1
    } else {
      // 无 key 或未命中：直接挂到真实容器（非 null！）
      // 挂到 null 容器时，若新节点是「render 返回 Fragment 的组件」且其 children
      // 又含 keyed 节点，内层 patchKeyedChildren 的 insertBefore(container=null)
      // 会 TypeError（子树丢失）。挂到 container 后元素已在容器内，第 5 步
      // insertBefore 仅调整顺序（参照 Vue：新增节点直接 patch 到真实 container）
      //
      // 同一对象短路（缓存 subTree 自我 patch）：newVNode 已在 oldList 中（同一
      // 对象），DOM 已挂载——若 mountVNode 会无条件重建覆盖 vnode.el =》 旧 DOM
      // 残留累积。跳过 mount，位置由第 5 步 insertBefore 调整。
      if (oldList.includes(newVNode)) continue
      mountVNode(newVNode, container, parent)
    }
  }

  // 3. 卸载未被复用的旧节点（同一对象已在 newList 中 =》 不卸载，防自我 patch 误删）
  oldList.forEach((oldVNode, i) => {
    if (oldVNode && !source.includes(i + 1) && !newList.includes(oldVNode)) {
      unmount(oldVNode, container, i)
    }
  })

  // 4. LIS：source 上求最长递增子序列（对应旧节点保持原位，不移动）
  const seq = getSequence(source)
  let j = seq.length - 1

  // 5. 从后往前插入/移动：anchor 为 i+1 项（已处理，位置正确）
  for (let i = newLen - 1; i >= 0; i--) {
    const newVNode = newList[i]
    if (newVNode == null) continue
    // 收集子树所有真实 DOM 元素：组件 render 返回 Fragment 时组件 vnode.el 为
    // null（Fragment 无自身 DOM），若跳过整棵子树永不插入 DOM（keyed diff bug）；
    // 多个子节点（Fragment 多根）需全部按序插入
    const els = collectDomEls(newVNode)
    if (els.length === 0) continue
    const anchor = i + 1 < newLen ? firstDomEl(newList[i + 1]) : null
    if (source[i] === 0) {
      // 新节点：插入到 anchor 前
      for (const el of els) container.insertBefore(el, anchor)
    } else if (j < 0 || i !== seq[j]) {
      // 复用节点但不在 LIS 上 → 需要移动
      for (const el of els) container.insertBefore(el, anchor)
    } else {
      j-- // 在 LIS 上，保持原位
    }
  }
}

/**
 * 收集 vnode 子树中所有真实 DOM 元素（文档顺序）。
 * 普通节点 =》 [el]；组件/Fragment 递归（__avChildren 为 patchChildren 缓存的
 * vnode 列表，文本节点 el 持久化，可精确定位）。用于 keyed diff 插入/移动：
 * Fragment 根组件可能贡献多个 DOM 节点，需全部插入。
 */
function collectDomEls(vnode: any, out: Node[] = []): Node[] {
  if (vnode == null) return out
  if (vnode.el != null) {
    out.push(vnode.el)
    return out
  }
  // 组件：取子树（subTree 更新后 el 已刷新）
  if (vnode.component?.subTree) {
    collectDomEls(vnode.component.subTree, out)
    return out
  }
  // Fragment：children 列表
  if (Array.isArray(vnode.__avChildren)) {
    for (const child of vnode.__avChildren) collectDomEls(child, out)
  }
  return out
}

/** 取 vnode 子树中第一个真实 DOM 元素（锚点计算用） */
function firstDomEl(vnode: any): Node | null {
  const els = collectDomEls(vnode)
  return els.length > 0 ? els[0] : null
}

// 最长递增子序列（返回下标数组；贪心 + 二分 + 前驱链回溯，值 0 表示新节点不参与）
function getSequence(arr: number[]): number[] {
  const p = arr.slice() // 前驱索引链
  const result: number[] = [] // tails：按末尾值递增的 LIS 末端下标
  for (let i = 0; i < arr.length; i++) {
    const val = arr[i]
    if (val === 0) continue
    // 二分：找第一个末尾值 >= val 的位置
    let lo = 0
    let hi = result.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (arr[result[mid]] < val) lo = mid + 1
      else hi = mid
    }
    if (lo > 0) p[i] = result[lo - 1]
    result[lo] = i
  }
  // 回溯前驱链，得到真实 LIS 下标
  let len = result.length
  let k = result[len - 1]
  while (len-- > 0) {
    result[len] = k
    k = p[k]
  }
  return result
}

/**
 * scopedId 约定（@actview/plugin-scoped，见 runtime/scopedProps.ts）：组件边界
 * 注入形态的 data-v-* 已由 extractScopedIdProps 合并为 scopedId prop（值为 scoped
 * 属性名，可空格分隔多个）；子组件手动应用到根元素（<div scopedId={props.scopedId}>
 * 或 <div {...props}>），此处把 scopedId 翻译为真实 scoped 属性。
 */
function patchProps(oldProps: any, newProps: any, el: Element) {
  oldProps = oldProps || {}
  newProps = newProps || {}

  // scopedId 翻译：值 = scoped 属性名（可空格分隔多个）；旧值变化时移除旧属性
  const oldScopedAttrs = splitScopedId(oldProps[SCOPED_ID_PROP])
  const newScopedAttrs = splitScopedId(newProps[SCOPED_ID_PROP])
  if (oldScopedAttrs.length > 0 || newScopedAttrs.length > 0) {
    const oldSet = new Set(oldScopedAttrs)
    const newSet = new Set(newScopedAttrs)
    for (const attr of oldScopedAttrs) {
      if (!newSet.has(attr)) el.removeAttribute(attr)
    }
    for (const attr of newScopedAttrs) {
      if (!oldSet.has(attr)) el.setAttribute(attr, '')
    }
  }

  // 删除旧 props 中已不存在的属性
  for (const key in oldProps) {
    if (key === 'children' || key === 'ref' || key === SCOPED_ID_PROP) continue
    if (!(key in newProps)) {
      setProp(el, key, undefined)
    }
  }
  // 设置/更新新 props：值未变（Object.is）直接跳过，避免无条件写 DOM
  // （选中行高亮等场景：1000 行 props 每次重渲染都相同，只重写真正变化的行）
  for (const key in newProps) {
    if (key === 'children' || key === 'ref' || key === SCOPED_ID_PROP) continue
    if (Object.is(oldProps[key], newProps[key])) continue
    setProp(el, key, newProps[key])
  }
}

// ------------------------------------------------------------
// 事件系统：addEventListener + capture + invoker 统一解绑（参考 Vue 3 patchEvent）
//   - onClick → 'click'；onClickCapture → 'click' + capture
//   - 同一元素同一事件的 handler 更新时只换 invoker.value，不重新 addEventListener
//   - handler 为 null/undefined 时解绑并移除 invoker
// ------------------------------------------------------------

interface Invoker extends Function {
  value: any
  attached: number
}

/** 事件 props 名 → 事件名 + 修饰符：onClick → click；onClickCapture → click + capture；onScrollPassive → scroll + passive */
function parseEventKey(
  key: string
): { eventName: string; capture: boolean; passive: boolean } | null {
  let name = key.slice(2) // 去掉 'on'
  if (!name) return null
  let capture = false
  let passive = false
  if (name.endsWith('CapturePassive')) {
    capture = true
    passive = true
    name = name.slice(0, -15)
  } else if (name.endsWith('Passive')) {
    passive = true
    name = name.slice(0, -7)
  } else if (name.endsWith('Capture')) {
    capture = true
    name = name.slice(0, -7)
  }
  // DOM 标准事件名均为小写（onMouseDown → mousedown）；oninput 本就小写
  return { eventName: name.toLowerCase(), capture, passive }
}

function patchEvent(el: any, key: string, value: any) {
  const parsed = parseEventKey(key)
  if (!parsed) return
  const { eventName, capture, passive } = parsed
  const vei = (el._vei ??= {}) as Record<string, Invoker>
  let invoker = vei[key]

  if (value) {
    if (invoker) {
      // handler 更新：仅替换 value，无需重新绑定
      invoker.value = value
      return
    }
    invoker = vei[key] = ((e: Event) => {
      invoker.value(e)
    }) as unknown as Invoker
    invoker.value = value
    invoker.attached = Date.now()
    el.addEventListener(eventName, invoker, { capture, passive })
  } else if (invoker) {
    // 解绑（removeEventListener 只需 capture 匹配，passive 忽略）
    el.removeEventListener(eventName, invoker, capture)
    delete vei[key]
  }
}

function setProp(el: any, key: string, value: any) {
  // 事件：addEventListener + capture + invoker 统一解绑（参考 Vue 3 patchEvent）
  if (key.startsWith('on')) {
    patchEvent(el, key, value)
    return
  }
  // dangerouslySetInnerHTML：注入 HTML 字符串
  if (key === 'dangerouslySetInnerHTML') {
    el.innerHTML =
      value && value.__html != null ? String(value.__html) : ''
    return
  }
  // class / style / value / checked 走 property
  if (key === 'class' || key === 'className') {
    el.className = value ?? ''
    return
  }
  if (key === 'style') {
    if (typeof value === 'string') el.style.cssText = value
    else if (value) Object.assign(el.style, value)
    else el.removeAttribute('style')
    return
  }
  if (
    key === 'value' ||
    key === 'checked' ||
    key === 'disabled' ||
    key === 'readonly'
  ) {
    if (value == null || value === false) {
      el.removeAttribute(key)
    } else if (key === 'value') {
      // 受控 input：赋值可能重置光标到末尾，更新前后记录并恢复
      setInputValue(el, value)
    } else {
      el[key] = value
    }
    return
  }
  // 其余走 attribute
  if (value == null || value === false) {
    el.removeAttribute(key)
  } else if (value === true) {
    el.setAttribute(key, '')
  } else {
    el.setAttribute(key, String(value))
  }
}

/**
 * 受控 input 赋值：浏览器对 value 赋值会把光标移到末尾，
 * 赋值前记录 selectionStart/End，赋值后恢复（截断到新值长度内）。
 * 仅当元素聚焦且值确实变化时处理，避免无谓操作。
 */
function setInputValue(el: any, value: any) {
  const str = String(value)
  if (el.value === str) return

  const active =
    typeof document !== 'undefined' && document.activeElement === el
  const start = active ? el.selectionStart : null
  const end = active ? el.selectionEnd : null

  el.value = str

  if (
    active &&
    typeof start === 'number' &&
    typeof el.selectionStart === 'number'
  ) {
    el.selectionStart = Math.min(start, str.length)
    el.selectionEnd = Math.min(end ?? start, str.length)
  }
}

// ------------------------------------------------------------
// 替换与卸载
// ------------------------------------------------------------

function replace(
  oldVnode: any,
  newVnode: any,
  container: Element,
  index?: number,
  parent?: any
) {
  const oldEl =
    oldVnode.el ?? (index != null ? container.childNodes[index] : null)
  const domParent = oldEl?.parentNode
  const anchor = oldEl?.nextSibling ?? null
  // 先卸载旧节点：keep-alive 缓存的组件走缓存分支（DOM 移入隐藏容器、实例保留），
  // 否则组件停止 effect 并触发 beforeUnmount、元素移除 DOM
  unmount(oldVnode, container, index)
  // 挂载新节点，再移动到旧节点的原位置（保持兄弟顺序）
  const newEl = mountVNode(newVnode, container, parent)
  if (
    domParent &&
    newEl &&
    newEl.parentNode === domParent &&
    anchor &&
    anchor.parentNode === domParent
  ) {
    domParent.insertBefore(newEl, anchor)
  }
}

export function unmount(vnode: any, container?: Element, index?: number) {
  if (vnode == null) return
  // <solid> 块：停止块内全部 effect + 移除 DOM
  if (vnode.$$typeof === SOLID_TYPE) {
    unmountSolid(vnode)
    return
  }
  // keep-alive 缓存：DOM 移入隐藏容器、实例保留（不销毁、不停 effect），
  // 重新激活时从缓存恢复；失活触发 deactivated；超出 max 淘汰最旧
  const keepAlive = vnode.__keepAlive
  if (keepAlive) {
    const { cache, storage, key, max } = keepAlive
    const el = vnode.component?.subTree?.el ?? vnode.el
    if (el && el.parentNode) storage.appendChild(el)
    cache.set(key, vnode)
    invokeHooks(vnode.component?.deactivated)
    // max LRU 淘汰：超出上限时卸载最旧缓存项
    if (max != null) {
      while (cache.size > max) {
        const oldestKey = cache.keys().next().value
        const oldest = cache.get(oldestKey)
        oldest?.component?.unmount?.()
        cache.delete(oldestKey)
      }
    }
    delete vnode.__keepAlive
    return
  }
  // TransitionGroup：列表项删除动画 —— 播放 leave 后延迟卸载
  const transitionGroup = vnode.__transitionGroup
  if (transitionGroup) {
    const el = vnode.component?.subTree?.el ?? vnode.el
    if (el && el.parentNode) {
      playLeave(el, transitionGroup, () => {
        if (el.parentNode) el.parentNode.removeChild(el)
        vnode.component?.unmount?.()
      })
    } else {
      vnode.component?.unmount?.()
    }
    return
  }
  // 内置组件：Teleport =》 从目标容器移除；Transition =》 直接卸载子节点（无动画）
  if (vnode.type?.__builtin === 'teleport') {
    unmountTeleport(vnode)
    return
  }
  if (vnode.type?.__builtin === 'transition') {
    unmountTransition(vnode)
    return
  }
  // 组件：先停止其更新 effect，防止响应式变化操作已移除的 DOM
  if (isComponentVNode(vnode)) {
    vnode.component?.unmount?.()
  }
  // 移除 vnode 子树的所有真实 DOM：组件 render 返回 Fragment 时组件 vnode.el
  // 为 null（Fragment 无自身 DOM），按 childNodes[index] 恢复会取错/漏删节点，
  // 必须沿子树收集全部 DOM 逐一移除
  const domEls = collectDomEls(vnode)
  if (domEls.length > 0) {
    for (const el of domEls) {
      if (el && el.parentNode) el.parentNode.removeChild(el)
    }
  } else {
    // 文本旧节点无持久 el（每次 render 重建），按索引从 childNodes 恢复
    const el =
      vnode.el ??
      (container && index != null ? container.childNodes[index] : null)
    if (el && el.parentNode) {
      el.parentNode.removeChild(el)
    }
  }
  // 模板引用：卸载时置 null
  applyRef(vnode.props?.ref, null)
}
