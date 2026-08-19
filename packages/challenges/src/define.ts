// ============================================================
// defineChallenge — 挑战定义工厂
// ============================================================

import type { Challenge } from './types'

/** 定义一道挑战（纯类型工厂，运行时原样返回） */
export function defineChallenge(challenge: Challenge): Challenge {
  return challenge
}
