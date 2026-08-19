// ============================================================
// reactivity-watch-effect — 挑战定义（断言部分：框架保留，勿改）
// ============================================================

import { defineChallenge } from '@actview/challenges'

export default defineChallenge({
  id: 'reactivity-watch-effect',
  title: 'watchEffect 依赖追踪：变化日志',
  difficulty: 'medium',
  tags: ['reactivity', 'watchEffect'],
  description: `用 watchEffect 实现 useLogger(source: Ref<number>)，返回 { log: Ref<number[]> }：
- watchEffect 首次立即执行，把 source 初始值 push 进 log
- source 变化后，把新值 push 进 log
- 期望：source=1 → log=[1]；source 变 2 → log=[1,2]`,
  template: `import { ref, watchEffect } from 'actview'

// 任务：useLogger(source) 返回 { log: Ref<number[]> }
// 用 watchEffect 追踪 source：首次记录初始值，之后每次变化追加记录
export function useLogger(source) {
  // TODO
}`,
  verify: async (ctx) => {
    const { solution, actview, assert } = ctx
    const { useLogger } = solution

    assert.truthy('导出了 useLogger', typeof useLogger === 'function')

    const source = actview.ref(1)
    const { log } = useLogger(source)

    assert.equal(
      '首次立即执行，记录初始值',
      log.value,
      [1],
      'watchEffect 应首次立即执行一次（Vue 3 语义），把 source 初始值记入 log'
    )

    source.value = 2
    // watchEffect 依赖变化后异步触发（微任务）
    await actview.nextTick()

    assert.equal(
      '源变化后追加记录',
      log.value,
      [1, 2],
      'source 变化后 log 未追加：确认在 watchEffect 回调内读取 source.value（读不到就不会被追踪）'
    )
  }
})
