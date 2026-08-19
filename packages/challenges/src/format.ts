// ============================================================
// formatResult — 把判题结果格式化为可读文本（CLI / 测试输出用）
// ============================================================

import type { ChallengeResult } from './types'

/** LeetCode 风格结果文本 */
export function formatResult(result: ChallengeResult): string {
  const lines: string[] = []
  lines.push(
    `${result.pass ? '✅' : '❌'} ${result.challengeId} — ${result.durationMs.toFixed(0)}ms`
  )

  if (result.error) {
    lines.push(`  [${result.error.type}] ${result.error.message}`)
    if (result.error.stack) {
      lines.push(
        '  ' +
          result.error.stack
            .split('\n')
            .slice(0, 4)
            .join('\n  ')
      )
    }
  }

  for (const c of result.checks) {
    if (c.pass) {
      lines.push(`  ✓ ${c.name}`)
    } else {
      lines.push(`  ✗ ${c.name}: ${c.message ?? ''}`)
      if (c.hint) lines.push(`    💡 ${c.hint}`)
    }
  }

  return lines.join('\n')
}
