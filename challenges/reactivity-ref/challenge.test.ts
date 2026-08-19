// ============================================================
// 判题入口（框架保留，勿改）
//   模式由 CLI 环境变量决定：
//     CHALLENGE_RUN=1      跑用户 solution（pnpm challenge run <id>）
//     CHALLENGE_REFERENCE=1 用参考实现自检（pnpm challenge verify-all）
//     无 env → 跳过（普通 pnpm test 不判题）
// ============================================================

import { it, expect } from 'vitest'
import { runChallenge, formatResult } from '@actview/challenges'
import challenge from './challenge'

const mode = process.env.CHALLENGE_RUN === '1'
  ? 'user'
  : process.env.CHALLENGE_REFERENCE === '1'
    ? 'reference'
    : 'skip'

let solution: Record<string, unknown>
if (mode === 'user') {
  solution = await import('./solution.tsx')
} else if (mode === 'reference') {
  solution = await import('./solution.reference.tsx')
}

it.skipIf(mode === 'skip')(`challenge: ${challenge.id}`, async () => {
  const result = await runChallenge(challenge, solution!)
  expect(result.pass, formatResult(result)).toBe(true)
})
