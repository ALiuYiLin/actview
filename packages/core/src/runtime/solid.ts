// ============================================================
// <solid> 双模细粒度运行时（一期）
//  - createSolidVNode：<solid> 块产物——惰性建 DOM 的占位 vnode
//  - mapArray：项级 keyed 复用（参考 solid reactive/array.ts mapArray）
//  - createEffect：块内动态绑定（立即执行 + 响应式追踪 + 依赖变重跑）
// 生命周期：createSolidVNode 的 __create 在独立 EffectScope 内执行，
// 块内所有 effect（含 mapArray 每项）自动注册进该 scope，卸载时
// scope.stop() 一并清理（配合 renderer unmount 的 solid 分支）。
// ============================================================

import { runEffect, queueJob } from '../reactivity/reactive-system'
import { EffectScope } from '../reactivity/effectScope'

export const SOLID_TYPE = Symbol.for('actview.solid')

/** 块内动态绑定：立即执行 + 追踪读取 + 依赖变重跑（等价 solid createEffect） */
export function createEffect(fn: () => void) {
  return runEffect(fn)
}

/** <solid> 块占位 vnode：__create 只执行一次（挂载时，scope 内），返回块根 DOM */
export function createSolidVNode(create: (container: Element | null) => any): any {
  return {
    $$typeof: SOLID_TYPE,
    type: 'solid',
    key: null,
    ref: null,
    props: {},
    __create: create,
    __el: null,
    __scope: null,
  }
}

/** solidGet：render 重跑时的 vnode 缓存（holder 为 setup 级 const，跨 render 持久） */
export function solidGet(holder: { __v?: any }, create: (container: Element | null) => any): any {
  if (!holder.__v) holder.__v = createSolidVNode(create)
  return holder.__v
}

/** 挂载 solid 块：在独立 EffectScope 内执行 __create(container)（块内 effect 注册进 scope） */
export function mountSolid(vnode: any, container: Element | null) {
  if (vnode.__el) return vnode.__el
  const scope = new EffectScope()
  vnode.__scope = scope
  vnode.__el = scope.run(() => vnode.__create(container))
  // 块内自己管理插入（mapArray / 元素 appendChild 到 container）；__el 有值时兜底插入
  if (vnode.__el && container) container.appendChild(vnode.__el)
  return vnode.__el
}

/** 卸载 solid 块：停止块内全部 effect，移除 DOM */
export function unmountSolid(vnode: any) {
  vnode.__scope?.stop()
  vnode.__scope = null
  const el = vnode.__el
  if (el && el.parentNode) el.parentNode.removeChild(el)
  vnode.__el = null
}

/**
 * 项级 keyed 复用（对齐 solid reactive/array.ts 的 mapArray）：
 *  - list() 每次变化（响应式追踪）→ 项级 diff（公共前缀/后缀跳过 + Map 索引复用）
 *  - 复用项零成本：DOM + 内部订阅保留，只移动位置
 *  - 新增项才创建（独立 EffectScope，mapFn 内 effect 注册进该项 scope）
 *  - 消失项 dispose（scope.stop() 清理其订阅）
 */
export function mapArray(
  list: () => any[],
  parent: Element,
  mapFn: (item: any, index: number) => Element,
) {
  let items: any[] = []
  let scopes: EffectScope[] = []
  let els: Element[] = []
  let len = 0

  // scheduler: queueJob —— 数组修改方法（splice 等）内部多次 trigger，
  // 同步重跑会读到中间态；入队统一 flush 后读最终态（与组件 update 一致）
  runEffect(
    () => {
    const newItems = list()
    const newLen = newItems.length

    // 快路径：空数组
    if (newLen === 0) {
      if (len !== 0) {
        for (const s of scopes) s.stop()
        for (const el of els) {
          if (el && el.parentNode) el.parentNode.removeChild(el)
        }
        items = []
        scopes = []
        els = []
        len = 0
      }
      return
    }
    // 快路径：首次创建
    if (len === 0) {
      for (let j = 0; j < newLen; j++) {
        items[j] = newItems[j]
        const scope = new EffectScope()
        scopes[j] = scope
        els[j] = scope.run(() => mapFn(newItems[j], j))!
        parent.appendChild(els[j])
      }
      len = newLen
      return
    }

    // 一般 diff：公共前缀/后缀 + Map 复用
    const tempEls: (Element | undefined)[] = new Array(newLen)
    const tempScopes: (EffectScope | undefined)[] = new Array(newLen)
    const oldIdxOf: number[] = new Array(newLen).fill(-1) // 复用项：新位置 j → 旧索引
    let start = 0
    let end = len - 1
    let newEnd = newLen - 1
    // 公共前缀
    for (; start < len && start < newLen && items[start] === newItems[start]; start++) {
      tempEls[start] = els[start]
      tempScopes[start] = scopes[start]
      oldIdxOf[start] = start
    }
    // 公共后缀
    for (; end >= start && newEnd >= start && items[end] === newItems[newEnd]; end--, newEnd--) {
      tempEls[newEnd] = els[end]
      tempScopes[newEnd] = scopes[end]
      oldIdxOf[newEnd] = end
    }
    // 中间：旧项是否仍在新集合中（按值引用匹配）
    const newIndices = new Map<any, number>()
    for (let j = newEnd; j >= start; j--) {
      newIndices.set(newItems[j], j)
    }
    for (let i = start; i <= end; i++) {
      const item = items[i]
      const j = newIndices.get(item)
      if (j !== undefined) {
        tempEls[j] = els[i]
        tempScopes[j] = scopes[i]
        oldIdxOf[j] = i
        newIndices.delete(item)
      } else {
        scopes[i].stop() // 消失的项：清理订阅 + 移除 DOM
        const gone = els[i]
        if (gone && gone.parentNode) gone.parentNode.removeChild(gone)
      }
    }
    // 填入：新增项创建
    for (let j = start; j < newLen; j++) {
      if (tempEls[j] !== undefined) {
        els[j] = tempEls[j]!
        scopes[j] = tempScopes[j]!
      } else {
        const scope = new EffectScope()
        scopes[j] = scope
        els[j] = scope.run(() => mapFn(newItems[j], j))!
      }
    }
    // 长度收缩：清理尾部多余项（订阅 + DOM）——被复用到新位置的旧项跳过
    const reusedIdx = new Set<number>()
    for (const i of oldIdxOf) if (i !== -1) reusedIdx.add(i)
    for (let j = newLen; j < len; j++) {
      if (reusedIdx.has(j)) continue
      scopes[j]?.stop()
      const gone = els[j]
      if (gone && gone.parentNode) gone.parentNode.removeChild(gone)
    }
    els.length = newLen
    scopes.length = newLen
    items = newItems.slice(0)
    len = newLen

    // 按新顺序重排：顺序未变（update/select/remove 等常见场景）→ 零移动；
    // 乱序（swap 等）→ LIS 最小移动（对齐 Vue patchKeyedChildren 策略）
    let inOrder = true
    for (let j = 0; j < newLen; j++) {
      if (parent.childNodes[j] !== els[j]) {
        inOrder = false
        break
      }
    }
    if (!inOrder && newLen > 0) {
      // 只保留复用项位置的 LIS；新增项（oldIdxOf=-1）不参与，统一由下方移动循环挂载
      const seq = getSequence(oldIdxOf).filter((i) => oldIdxOf[i] !== -1)
      let j = seq.length - 1
      let anchor: Node | null = null
      for (let i = newLen - 1; i >= 0; i--) {
        if (i !== seq[j]) {
          // 未挂载（新增项）或位置错误才移动
          if (!els[i].isConnected || els[i].nextSibling !== anchor) parent.insertBefore(els[i], anchor)
        } else {
          j--
        }
        anchor = els[i]
      }
    }
    },
    { scheduler: queueJob },
  )
}

/** 最长递增子序列（Vue 的 getSequence）：返回构成 LIS 的下标数组 */
function getSequence(arr: number[]): number[] {
  const p = arr.slice()
  const result = [0]
  let i, j, u, v, c
  const len = arr.length
  for (i = 0; i < len; i++) {
    const arrI = arr[i]
    if (arrI !== -1) {
      j = result[result.length - 1]
      if (arr[j] < arrI) {
        p[i] = j
        result.push(i)
        continue
      }
      u = 0
      v = result.length - 1
      while (u < v) {
        c = (u + v) >> 1
        if (arr[result[c]] < arrI) u = c + 1
        else v = c
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) p[i] = result[u - 1]
        result[u] = i
      }
    }
  }
  u = result.length
  v = result[u - 1]
  while (u-- > 0) {
    result[u] = v
    v = p[v]
  }
  return result
}
