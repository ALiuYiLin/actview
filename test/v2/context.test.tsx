// ============================================================
// v2 createContext + style 响应式更新（回归）
//   Provider value 传 reactive 对象（store-as-is 契约）→ 消费端
//   render 里读 ctx.size → 依赖收集 → setSize 切换 → 全部更新。
//   p 的 style 用数字三目——验证「style 数字 → px」在 context 场景生效。
// ============================================================
import { describe, expect, it } from 'vitest'
import { createApp, createContext, reactive } from 'actview'

const SizeCtx = createContext<
  { size: string; setSize: (s: string) => void } | undefined
>(undefined)

function SizeLabel() {
  const s = SizeCtx.use()!
  return <span>当前字号:{s.size}</span>
}

function SizeButton() {
  const s = SizeCtx.use()!
  return <button onClick={() => s.setSize(s.size === '大' ? '小' : '大')}>切换</button>
}

function DemoContext() {
  const ctx = reactive({
    size: '大',
    setSize(next: string) {
      this.size = next
    },
  })
  return (
    <SizeCtx.Provider value={ctx}>
      <div>
        <SizeLabel />
        <SizeButton />
        <p style={{ fontSize: ctx.size === '大' ? 20 : 13, margin: 0 }}>
          字号来自 context(ctx.size)
        </p>
      </div>
    </SizeCtx.Provider>
  )
}

function mount(App: any): HTMLElement {
  const host = document.createElement('div')
  createApp(App).mount(host)
  return host
}

describe('v2: context 响应式 + style px', () => {
  it('Provider 内外消费端同步更新，p 字号随 ctx.size 切换', async () => {
    const host = mount(DemoContext)
    const p = host.querySelector('p') as HTMLElement
    // 初始：三目数字 20 → 编译期 '20px'
    expect(host.querySelector('span')?.textContent).toBe('当前字号:大')
    expect(p.getAttribute('style')).toContain('font-size: 20px')
    // 点击切换 → setSize('小') → 消费端全部更新 + p 字号 13px
    ;(host.querySelector('button') as HTMLElement).click()
    await new Promise((r) => setTimeout(r, 0))
    expect(host.querySelector('span')?.textContent).toBe('当前字号:小')
    expect(p.getAttribute('style')).toContain('font-size: 13px')
  })
})
