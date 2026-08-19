// ============================================================
// @actview/challenges — 类型定义
//   挑战 = 题目（模板 + 框架保留的断言），用户填 solution，
//   判题引擎黑盒验收"对框架 API 的正确使用"（行为，非实现）。
// ============================================================

import type { nextTick } from '@actview/core'
import type { fireEvent, waitFor } from '@actview/testing'

/** 挑战定义：模板 + 断言（断言部分由框架保留，用户不可见/不可改） */
export interface Challenge {
  id: string
  title: string
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  /** 题目说明（markdown，展示给用户） */
  description: string
  /** 用户看到的初始代码（含 TODO 占位） */
  template: string
  /** 黑盒验收：对用户 solution 的行为断言 */
  verify: (ctx: VerifyContext) => void | Promise<void>
}

/** 单条断言结果 */
export interface CheckResult {
  name: string
  pass: boolean
  /** 失败详情（期望 vs 实际） */
  message?: string
  /** 框架语义提示（失败时引导用户理解框架） */
  hint?: string
}

/** 判题结果 */
export interface ChallengeResult {
  pass: boolean
  challengeId: string
  /** 失败阶段：exec = 用户代码运行抛错；verify = 断言未通过 */
  stage: 'exec' | 'verify'
  checks: CheckResult[]
  error?: { type: 'runtime' | 'assert'; message: string; stack?: string }
  durationMs: number
}

/** 断言工具：每条断言记录到 checks（失败不抛，收集全部失败点） */
export interface AssertApi {
  /** el.textContent 包含 expected */
  text(name: string, el: Element | null, expected: string, hint?: string): void
  /** el 包含 class */
  class(name: string, el: Element | null, cls: string, hint?: string): void
  /** el[data-testid] === id，且（若给 expectedText）textContent 包含 expectedText */
  testId(
    name: string,
    el: Element | null,
    id: string,
    expectedText?: string,
    hint?: string
  ): void
  /** value 为真 */
  truthy(name: string, value: unknown, hint?: string): void
  /** actual === expected */
  equal(name: string, actual: unknown, expected: unknown, hint?: string): void
  /** el 的直接子元素数量 === n */
  count(name: string, el: Element | null, n: number, hint?: string): void
}

/** 挑战专用渲染结果（支持 setProps 验收 props 响应性） */
export interface ChallengeRenderResult {
  container: HTMLElement
  /** 更新 props（就地写入 shallowReactive，触发组件重渲染） */
  setProps: (next: Record<string, unknown>) => void
  getByText: (text: string) => HTMLElement
  queryByText: (text: string) => HTMLElement | null
  getByClass: (cls: string) => HTMLElement
  queryByClass: (cls: string) => HTMLElement | null
  getByTestId: (id: string) => HTMLElement
  queryByTestId: (id: string) => HTMLElement | null
}

/** verify 收到的上下文 */
export interface VerifyContext {
  /** 用户 solution 模块的命名导出 */
  solution: Record<string, unknown>
  /** 完整框架 API（verify 可自行构造 ref 等作为输入） */
  actview: typeof import('@actview/core')
  /** 渲染用户组件（支持 props + setProps） */
  render: (
    component: any,
    options?: { props?: Record<string, unknown> }
  ) => ChallengeRenderResult
  fireEvent: typeof fireEvent
  waitFor: typeof waitFor
  nextTick: typeof nextTick
  assert: AssertApi
}
