// ============================================================
// 复现：Fragment 末尾 Teleport 时 getNextHostNode 取到 target 容器外的
// DOM（jsdom 严格 insertBefore 抛 NotFoundError）
// 运行：pnpm exec vitest run test/renderer/teleport-anchor-repro.test.tsx
// ============================================================
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { createApp, reactive, Teleport } from '@actview/core'

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('Fragment 末尾 Teleport 的替换锚点', () => {
  it('show=true(Fragment+Teleport) → false(span)：replace 的 anchor 取自 target', async () => {
    // body 里先放一个后续节点（portal 内容之后还有其他 DOM）
    document.body.appendChild(document.createElement('div'))

    const state = reactive({ show: true })
    function App() {
      return (
        <div class="app">
          {state.show ? (
            <>
              <Teleport to="body">
                <span class="tp">T</span>
              </Teleport>
            </>
          ) : (
            <span class="plain">P</span>
          )}
        </div>
      )
    }
    const host = document.createElement('div')
    host.id = 'repro'
    document.body.appendChild(host)
    createApp(App).mount('#repro')
    expect(document.querySelector('.tp')).toBeTruthy() // 内容在 body

    // 关键：portal 内容之后再加一个 body 节点（span.tp 的 nextSibling 在 body 里）
    document.body.appendChild(document.createElement('i'))

    // 切换：Fragment → span（type 不同 → replace → getNextHostNode(旧 Fragment)）
    state.show = false
    await flush()
    expect(host.querySelector('.plain')?.textContent).toBe('P')
  })
})
