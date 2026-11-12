// ============================================================
// Transition — 内置组件标记 + 进出场过渡类管理（M3 最小集）
//
//   renderer 按 `type.__builtin === 'transition'` 识别本组件，负责单子节点
//   的 patch/卸载；本模块只提供过渡类名与定时器：
//   - applyTransitionEnter(el, props)：挂载子节点后播放 enter；
//   - applyTransitionLeave(el, props, done)：卸载前播放 leave，duration 后
//     调 done() 由 renderer 真正卸载。
//
//   类名（name 默认 'v'）：
//     enter: `${name}-enter-from` + `${name}-enter-active`
//            → 下一帧：remove from / add `${name}-enter-to`
//            → duration 后 remove to/active，调用 props.onEnter
//     leave: `${name}-leave-from` + `${name}-leave-active`
//            → 下一帧：remove from / add `${name}-leave-to`
//            → duration 后清理类，调用 props.onLeave，再 done()
//
//   时长用 setTimeout（不依赖 CSS transitionend，happy-dom 不稳定）；
//   同一元素重复调用会清理上一轮定时器（el 上存 _transitionTimer）。
// ============================================================

import type { ComponentTag } from '@actview/runtime-core'

/** Transition 内置组件标记（renderer 只按 `__builtin` 字段识别） */
export const Transition = {
  __builtin: 'transition',
} as unknown as ComponentTag<any>

/** 默认过渡时长（ms） */
const DEFAULT_DURATION = 300

/** 无 requestAnimationFrame 时的「下一帧」延迟（ms） */
const FRAME_FALLBACK_DELAY = 16

/** enter / leave 三个阶段后缀 */
const PHASES = ['enter', 'leave'] as const
const SUFFIXES = ['from', 'active', 'to'] as const

interface TransitionProps {
  name?: string
  duration?: number
  onEnter?: (el: Element) => void
  onLeave?: (el: Element) => void
  [key: string]: any
}

interface TransitionState {
  /** 调用序号：旧定时器回调发现 token 不匹配就直接退出 */
  token: number
  /** 上一次使用的类名前缀（props.name 变化时用于清理旧类） */
  name: string
  /** 下一帧定时器（rAF 或 setTimeout） */
  frameId: ReturnType<typeof setTimeout> | number | null
  frameIsRaf: boolean
  /** duration 定时器 */
  endTimer: ReturnType<typeof setTimeout> | null
}

/** 取/建元素上的过渡状态（el._transitionTimer） */
function getState(el: Element): TransitionState {
  let state = (el as any)._transitionTimer as TransitionState | undefined
  if (!state) {
    state = {
      token: 0,
      name: '',
      frameId: null,
      frameIsRaf: false,
      endTimer: null,
    }
    ;(el as any)._transitionTimer = state
  }
  return state
}

/** 清理旧定时器与旧类名，返回递增后的 token（重复调用时旧回调自动失效） */
function resetTransition(el: Element): { state: TransitionState; token: number } {
  const state = getState(el)

  if (state.frameId != null) {
    if (state.frameIsRaf && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(state.frameId as number)
    } else {
      clearTimeout(state.frameId as ReturnType<typeof setTimeout>)
    }
    state.frameId = null
  }
  if (state.endTimer != null) {
    clearTimeout(state.endTimer)
    state.endTimer = null
  }
  // 清理上一轮残留的类（name 可能已变化）
  if (state.name) stripTransitionClasses(el, state.name)

  state.token++
  return { state, token: state.token }
}

/** 移除某个 name 下的全部过渡类（enter/leave × from/active/to） */
function stripTransitionClasses(el: Element, name: string): void {
  const classList = el.classList
  for (const phase of PHASES) {
    for (const suffix of SUFFIXES) {
      classList.remove(`${name}-${phase}-${suffix}`)
    }
  }
}

/** 下一帧执行：优先 requestAnimationFrame，无则 setTimeout(16) */
function nextFrame(cb: () => void): { id: ReturnType<typeof setTimeout> | number; isRaf: boolean } {
  if (typeof requestAnimationFrame === 'function') {
    return { id: requestAnimationFrame(() => cb()), isRaf: true }
  }
  return { id: setTimeout(cb, FRAME_FALLBACK_DELAY), isRaf: false }
}

/** 过渡时长：props.duration ?? 300（非法值回退默认） */
function resolveDuration(props: TransitionProps | null | undefined): number {
  const raw = props?.duration
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return raw
  return DEFAULT_DURATION
}

/** 过渡类名前缀：props.name ?? 'v' */
function resolveName(props: TransitionProps | null | undefined): string {
  const name = props?.name
  if (typeof name === 'string' && name.length > 0) return name
  return 'v'
}

/** 结束一轮过渡（清理状态与类），供 enter/leave 完成时调用 */
function finishTransition(el: Element, name: string): void {
  stripTransitionClasses(el, name)
  const state = (el as any)._transitionTimer as TransitionState | undefined
  if (state) {
    state.frameId = null
    state.endTimer = null
  }
  ;(el as any)._transitionTimer = undefined
}

/**
 * 播放 enter 过渡：进入类 → 下一帧切换到 enter-to → duration 后清理。
 * 重复调用（同一元素）会取消上一轮并重新开始。
 */
export function applyTransitionEnter(
  el: Element,
  props?: TransitionProps | null,
): void {
  const { state, token } = resetTransition(el)
  const name = resolveName(props)
  state.name = name

  const classList = el.classList
  classList.add(`${name}-enter-from`, `${name}-enter-active`)

  const frame = nextFrame(() => {
    if (state.token !== token) return
    state.frameId = null
    classList.remove(`${name}-enter-from`)
    classList.add(`${name}-enter-to`)

    state.endTimer = setTimeout(() => {
      if (state.token !== token) return
      finishTransition(el, name)
      props?.onEnter?.(el)
    }, resolveDuration(props))
  })
  state.frameId = frame.id
  state.frameIsRaf = frame.isRaf
}

/**
 * 播放 leave 过渡：离开类 → 下一帧切换到 leave-to → duration 后清理类、
 * 调用 onLeave 与 done()（renderer 在 done 里真正卸载子节点）。
 */
export function applyTransitionLeave(
  el: Element,
  props: TransitionProps | null | undefined,
  done: () => void,
): void {
  const { state, token } = resetTransition(el)
  const name = resolveName(props)
  state.name = name

  const classList = el.classList
  classList.add(`${name}-leave-from`, `${name}-leave-active`)

  const frame = nextFrame(() => {
    if (state.token !== token) return
    state.frameId = null
    classList.remove(`${name}-leave-from`)
    classList.add(`${name}-leave-to`)

    state.endTimer = setTimeout(() => {
      if (state.token !== token) return
      finishTransition(el, name)
      props?.onLeave?.(el)
      done()
    }, resolveDuration(props))
  })
  state.frameId = frame.id
  state.frameIsRaf = frame.isRaf
}
