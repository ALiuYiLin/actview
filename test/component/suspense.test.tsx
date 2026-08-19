// ============================================================
// Suspense / lazy 异步组件（拆分自 test/runtime-enhance.test.tsx "Suspense 增强" +
//   test/verify.test.tsx 场景 15 中 Suspense + lazy it）
// 运行：pnpm exec vitest run test/component/suspense.test.tsx
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { createApp, nextTick, Suspense, lazy, defineComponent } from 'actview'

// ---------- helpers（来自 test/runtime-enhance.test.tsx）----------
const flush = () => new Promise((r) => setTimeout(r, 0))

let mountSeq = 0
function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'enh-host-' + mountSeq++
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

function collectText(el: any): string {
  if (el == null) return ''
  if (el.nodeType === 3) return el.textContent ?? ''
  return Array.from(el.childNodes).map(collectText).join('')
}

// ---------- helpers（来自 test/verify.test.tsx，因 mount 签名不同而重命名）----------
/** 创建带容器 id 的宿主元素并挂载组件（来自 verify.test.tsx） */
function mountId(containerId: string, component: any) {
  const host = document.createElement('div')
  host.id = containerId.slice(1)
  document.body.appendChild(host)
  createApp(component).mount(containerId)
  return host
}

// ============================================================
// test/runtime-enhance.test.tsx — Suspense 增强
// ============================================================
describe('Suspense 增强', () => {
  it('异步 setup（返回 Promise<render>）配合 Suspense', async () => {
    const Async = defineComponent(async function () {
      await Promise.resolve()
      return () => <div class="async">async content</div>
    })
    function App() {
      return (
        <Suspense fallback={<div class="loading">loading</div>}>
          <Async />
        </Suspense>
      )
    }
    const host = mount(App)
    await flush()
    expect(collectText(host)).toContain('async content')
  })

  it('嵌套 Suspense 独立 fallback', async () => {
    const Inner = defineComponent(async function () {
      await Promise.resolve()
      return () => <div class="inner">inner</div>
    })
    function App() {
      return (
        <Suspense fallback={<div class="outer-loading">outer</div>}>
          <div class="outer-wrap">
            <Suspense fallback={<div class="inner-loading">inner-loading</div>}>
              <Inner />
            </Suspense>
          </div>
        </Suspense>
      )
    }
    const host = mount(App)
    await flush()
    expect(host.querySelector('.inner')).not.toBeNull()
  })
})

// ============================================================
// test/verify.test.tsx — 场景 15：Suspense + lazy
// ============================================================
describe('场景 15：错误边界 / Suspense / lazy / ref', () => {
  it('Suspense + lazy 异步组件：fallback → loaded', async () => {
    let resolveLoader!: (m: any) => void
    const LazyComp = lazy(() => new Promise((res) => { resolveLoader = res }))
    function App() {
      return (
        <div>
          <Suspense fallback={<span>loading...</span>}>
            <LazyComp />
          </Suspense>
        </div>
      )
    }
    const host = mountId('#s15c', App)

    // lazy 注册 pending → Suspense 显示 fallback
    await nextTick()
    expect(collectText(host)).toContain('loading...')

    // loader 完成 → Suspense resolve → 渲染真实组件（defineComponent 约定 setup 返回 render 函数）
    resolveLoader({ default: defineComponent(function Loaded() { return () => <i>loaded!</i> }) })
    await nextTick()
    await nextTick()
    expect(collectText(host)).toContain('loaded!')
  })
})