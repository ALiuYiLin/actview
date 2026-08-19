// ============================================================
// runChallenge — 判题引擎
//   执行 challenge.verify（黑盒行为验收），断言逐条收集，
//   用户代码运行抛错 → stage 'exec'；断言未通过 → stage 'verify'。
// ============================================================

import { nextTick } from '@actview/core'
import { fireEvent, waitFor } from '@actview/testing'
import { createAssert } from './assert'
import { renderChallenge } from './render'
import type { Challenge, ChallengeResult, CheckResult } from './types'

export { renderChallenge } from './render'
export { createAssert } from './assert'
export type * from './types'

/**
 * 判题：把用户 solution 的命名导出交给 challenge.verify 黑盒验收。
 * 返回结构化结果（pass / 失败阶段 / 逐条断言 / 错误信息）。
 */
export async function runChallenge(
  challenge: Challenge,
  solution: Record<string, unknown>
): Promise<ChallengeResult> {
  const start = performance.now()
  const checks: CheckResult[] = []
  const assert = createAssert(checks)

  try {
    await challenge.verify({
      solution,
      actview: await import('@actview/core'),
      render: renderChallenge,
      fireEvent,
      waitFor,
      nextTick,
      assert
    })
  } catch (e) {
    // 用户代码运行错误（verify 内部调用户代码抛出的非断言错误）
    return {
      pass: false,
      challengeId: challenge.id,
      stage: 'exec',
      checks,
      error: {
        type: 'runtime',
        message: (e as Error).message ?? String(e),
        stack: (e as Error).stack
      },
      durationMs: performance.now() - start
    }
  }

  const pass = checks.every((c) => c.pass)
  return {
    pass,
    challengeId: challenge.id,
    stage: 'verify',
    checks,
    durationMs: performance.now() - start
  }
}
