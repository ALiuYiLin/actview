// ============================================================
// component-jsx — 挑战定义（断言部分：框架保留，勿改）
// ============================================================

import { defineChallenge } from '@actview/challenges'

export default defineChallenge({
  id: 'component-jsx',
  title: '组件 + JSX + 事件：带按钮的计数器',
  difficulty: 'medium',
  tags: ['component', 'jsx', 'event'],
  description: `实现 Counter 组件：
- count 用 ref(0) 维护
- 渲染 <p data-testid="count">count: {count}</p> 和
  <button data-testid="inc">+1</button>
- 点击 +1 后 count 加一，视图同步更新`,
  template: `import { ref } from 'actview'

// 任务：实现计数器组件
// - count 用 ref(0) 维护
// - 渲染 <p data-testid="count">count: {count}</p>
//   和 <button data-testid="inc">+1</button>
// - 点击 +1 后 count 加一（onClick 绑定事件）
export function Counter() {
  // TODO
}`,
  verify: async (ctx) => {
    const { solution, render, fireEvent, actview, assert } = ctx
    const { Counter } = solution

    assert.truthy('导出了 Counter 组件', Counter != null)

    const r = render(Counter, {})
    assert.testId('初始 count: 0', r.container, 'count', 'count: 0')

    fireEvent(r.getByTestId('inc'), 'click')
    await actview.nextTick()

    assert.testId(
      '点击 +1 后 count: 1',
      r.container,
      'count',
      'count: 1',
      '点击后 count 未更新：确认 onClick 里修改 count.value（ref 修改需走 .value），并已在 JSX 中渲染'
    )
  }
})
