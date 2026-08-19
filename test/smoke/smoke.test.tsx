// ============================================================
// 冒烟：src/main.tsx 检验页（路由版）
// 验证路由版页面渲染与路由切换、扩展能力页交互、生命周期页交互
// 拆分自 test/verify.test.tsx
// 运行：pnpm exec vitest run test/smoke/smoke.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { nextTick } from 'actview'

/** 收集元素文本（含文本节点） */
function collectText(el: any): string {
  if (el == null) return ''
  if (el.nodeType === 3) return el.textContent ?? ''
  return Array.from(el.childNodes).map(collectText).join('')
}

// ------------------------------------------------------------
// 冒烟：src/main.tsx 检验页（路由版）
// ------------------------------------------------------------
describe('冒烟：src/main.tsx 检验页', () => {
  it('路由版页面渲染与路由切换', async () => {
    const appHost = document.createElement('div')
    appHost.id = 'app'
    document.body.appendChild(appHost)

    await import('../../src/main.tsx')
    const routerMod = await import('../../src/router.ts')

    const appRoot = document.querySelector('#app')!
    expect(collectText(appRoot)).toContain('框架能力总览')
    expect(collectText(appRoot)).toContain('① 响应式')

    routerMod.router.push('/reactive')
    await nextTick()
    expect(collectText(appRoot)).toContain('count =')

    routerMod.router.push('/list')
    await nextTick()
    expect(collectText(appRoot)).toContain('Apple')
  })

  it('扩展能力页（⑤-⑩）渲染与交互', async () => {
    // main.tsx 固定挂载 #app：若已被前一个用例创建则复用
    if (!document.querySelector('#app')) {
      const h = document.createElement('div')
      h.id = 'app'
      document.body.appendChild(h)
    }
    await import('../../src/main.tsx')
    const routerMod = await import('../../src/router.ts')
    const appRoot = document.querySelector('#app')!
    const cases: [string, string][] = [
      ['/api', '响应式 API'],
      ['/array', '数组方法'],
      ['/slot', '插槽'],
      ['/home', '响应式'],
      ['/dynamic', 'keep-alive'],
      ['/async', '错误边界'],
    ]
    for (const [path, keyword] of cases) {
      routerMod.router.push(path)
      await nextTick()
      expect(collectText(appRoot)).toContain(keyword)
    }
    // 异步组件 1s 加载完成后渲染真实组件
    await new Promise((r) => setTimeout(r, 1200))
    await nextTick()
    expect(collectText(appRoot)).toContain('异步组件加载完成')
    // 错误边界：触发渲染错误 → fallback
    const boomBtn = Array.from(appRoot.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('触发渲染错误'),
    )
    boomBtn?.dispatchEvent(new Event('click'))
    await nextTick()
    expect(collectText(appRoot)).toContain('渲染出错')
  })

  it('生命周期页交互：挂载/更新/卸载计数即时刷新', async () => {
    if (!document.querySelector('#app')) {
      const h = document.createElement('div')
      h.id = 'app'
      document.body.appendChild(h)
    }
    await import('../../src/main.tsx')
    const routerMod = await import('../../src/router.ts')
    const appRoot = document.querySelector('#app')!
    const click = (label: string) => {
      const btn = Array.from(appRoot.querySelectorAll('button')).find((b) =>
        b.textContent?.includes(label),
      )
      btn?.dispatchEvent(new Event('click'))
    }

    routerMod.router.push('/lifecycle')
    await nextTick()
    // 进入页面：Child 挂载完成 → onMounted=1（响应式计数即时显示）
    expect(collectText(appRoot)).toContain('onMounted=1 次')
    expect(collectText(appRoot)).toContain('onUpdated=0 次')
    expect(collectText(appRoot)).toContain('onBeforeUnmount=0 次')

    // 触发 Child 更新（Child 读 state.n）→ onUpdated=1
    click('触发 Child 更新')
    await nextTick()
    expect(collectText(appRoot)).toContain('onUpdated=1 次')

    // 卸载 Child → onBeforeUnmount=1
    click('卸载 Child')
    await nextTick()
    expect(collectText(appRoot)).toContain('onBeforeUnmount=1 次')

    // 重新挂载 → onMounted=2（新实例重新注册钩子）
    click('挂载 Child')
    await nextTick()
    expect(collectText(appRoot)).toContain('onMounted=2 次')
  })
})