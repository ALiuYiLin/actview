// ============================================================
// @actview/challenges — 挑战判题引擎
//   用法：defineChallenge 定义题目（模板 + 框架保留的断言），
//   runChallenge(challenge, solution) 黑盒验收用户实现。
// ============================================================

export { defineChallenge } from './define'
export { runChallenge, renderChallenge, createAssert } from './runner'
export { formatResult } from './format'
export type {
  Challenge,
  ChallengeResult,
  CheckResult,
  AssertApi,
  VerifyContext,
  ChallengeRenderResult
} from './types'
