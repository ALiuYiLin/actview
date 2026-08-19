// ============================================================
// props-use-prop — 挑战定义（断言部分：框架保留，勿改）
//   核心考点：props 响应性 —— 父组件更新 prop 后视图必须同步
// ============================================================

import { defineChallenge } from '@actview/challenges'

export default defineChallenge({
  id: 'props-use-prop',
  title: 'useProps 响应式读取 props：父组件更新后视图同步',
  difficulty: 'medium',
  tags: ['component', 'props', 'reactivity'],
  description: `实现 Counter 组件，用 useProps 读取 props.count（默认 0），
渲染 <p data-testid="count">count: {count}</p>。
要求：父组件把 count prop 从 3 改成 10 后，视图同步更新为 count: 10。`,
  template: `import { useProps } from 'actview'

// 任务：Counter 组件，渲染 <p data-testid="count">count: {count}</p>
// - 用 useProps(props, { count: ... }) 读取 props.count（未传入默认 0）
// - 要求：父组件更新 count prop 后视图同步更新
export function Counter(props) {
  // TODO
}`,
  verify: async (ctx) => {
    const { solution, render, actview, assert } = ctx
    const { Counter } = solution

    assert.truthy('导出了 Counter 组件', Counter != null)

    // 初始渲染：count = 3
    const r = render(Counter, { props: { count: 3 } })
    assert.testId('初始渲染 count: 3', r.container, 'count', 'count: 3')

    // 父组件更新 prop → 视图必须同步
    r.setProps({ count: 10 })
    await actview.nextTick()

    assert.testId(
      'props 更新后视图同步为 count: 10',
      r.container,
      'count',
      'count: 10',
      '父组件更新 count 后视图未更新：不要在 setup 里直接解构 props（const { count } = props 是快照，丢失响应性）——用 useProps 读取'
    )

    // 未传入 count 时默认 0
    const r2 = render(Counter, {})
    assert.testId('未传 count 时默认 0', r2.container, 'count', 'count: 0')
  }
})
