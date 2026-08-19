// ============================================================
// context-basic — 挑战定义（断言部分：框架保留，勿改）
// ============================================================

import { defineChallenge } from '@actview/challenges'

export default defineChallenge({
  id: 'context-basic',
  title: 'createContext 跨层级共享状态：主题透传',
  difficulty: 'medium',
  tags: ['context', 'component'],
  description: `用 createContext 实现主题透传：
- ThemeContext 默认值 'light'
- App 用 Provider 把 props.theme 提供给子组件
- 子组件用 ThemeContext.use() 消费，渲染 <p data-testid="theme">当前主题: {theme}</p>
- App 的 theme prop 更新后，消费方视图同步更新`,
  template: `import { createContext } from 'actview'

// 任务：实现主题透传
// 1. 创建 ThemeContext，默认值 'light'
// 2. App 用 <ThemeContext.Provider value={props.theme}> 提供主题
// 3. 子组件用 ThemeContext.use() 消费（返回 ref），渲染
//    <p data-testid="theme">当前主题: {theme}</p>
export function App(props) {
  // TODO
}`,
  verify: async (ctx) => {
    const { solution, render, actview, assert } = ctx
    const { App } = solution

    assert.truthy('导出了 App 组件', App != null)

    const r = render(App, { props: { theme: 'dark' } })
    assert.testId(
      '子组件消费到 Provider 提供的主题',
      r.container,
      'theme',
      '当前主题: dark',
      '消费方未渲染出主题：子组件应通过 ThemeContext.use() 读取（返回 ref，用 .value 渲染）'
    )

    // theme prop 更新 → 消费方同步（Provider 内部 watch 是独立微任务，
    // nextTick 只等一轮 flush，用 waitFor 轮询到稳定）
    r.setProps({ theme: 'light' })
    await ctx.waitFor(() => {
      const el = r.container.querySelector('[data-testid="theme"]')
      if (!el || !(el.textContent ?? '').includes('当前主题: light')) {
        throw new Error('消费方尚未同步')
      }
    })

    assert.testId(
      'theme 更新后消费方同步',
      r.container,
      'theme',
      '当前主题: light',
      'Provider value 变化后消费方未更新：确认用 createContext 的 Provider 包裹并提供 value'
    )
  }
})
