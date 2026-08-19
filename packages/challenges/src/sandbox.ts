// ============================================================
// sandbox — 用户代码执行沙箱
//   1. happy-dom 提供 DOM 环境（document/window/navigator）
//   2. 注入 actview / jsx 运行时 / testing 工具
//   3. 执行编译后的 CJS 代码（new Function），返回 module.exports
// ============================================================

import { Window } from 'happy-dom'
// 注入的 __actview = @actview/core 导出（与 'actview' 统一入口等价）
import * as actview from '@actview/core'
import * as jsxRuntime from '@actview/jsx'
import * as testing from '@actview/testing'
import * as challenges from './index'

// ------------------------------------------------------------
// happy-dom 环境：挂到 globalThis（每次执行前重置，隔离污染）
// ------------------------------------------------------------

/** 挂载 happy-dom 全局（document/window/navigator/HTMLElement 等） */
export function setupDom() {
  const window = new Window()
  const globals: Record<string, unknown> = {
    window,
    document: window.document,
    navigator: window.navigator,
    HTMLElement: window.HTMLElement,
    HTMLDivElement: window.HTMLDivElement,
    HTMLParagraphElement: window.HTMLParagraphElement,
    HTMLButtonElement: window.HTMLButtonElement,
    HTMLInputElement: window.HTMLInputElement,
    Element: window.Element,
    Node: window.Node,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
    MouseEvent: window.MouseEvent,
    KeyboardEvent: window.KeyboardEvent,
    getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    // happy-dom 的 document 需要 innerWidth 等：补常用只读属性
    innerWidth: 1024,
    innerHeight: 768,
  }
  for (const [key, value] of Object.entries(globals)) {
    ;(globalThis as any)[key] = value
  }
}

// ------------------------------------------------------------
// 执行编译后的 CJS 代码
// ------------------------------------------------------------

export interface ExecuteOptions {
  /** 注入 __challenges 时用（challenge.ts 需要 defineChallenge） */
  withChallenges?: boolean
}

/**
 * 执行编译后的代码（含 __actview/__jsxRuntime/__testing 注入），
 * 返回 module.exports（即用户/题目的导出对象）。
 */
export function executeCompiled(code: string, options: ExecuteOptions = {}): Record<string, unknown> {
  const module = { exports: {} as Record<string, unknown> }
  const fn = new Function(
    '__actview',
    '__jsxRuntime',
    '__testing',
    '__challenges',
    '__exports',
    code,
  )
  fn(
    actview,
    jsxRuntime,
    testing,
    options.withChallenges ? challenges : {},
    module.exports,
  )
  return module.exports
}
