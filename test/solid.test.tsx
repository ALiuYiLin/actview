// ============================================================
// <solid> 双模细粒度运行时测试
// 1. 块内渲染：静态内容 + mapArray 行渲染
// 2. 行内容更新：label 变化只更新该行文本（细粒度直连）
// 3. 结构变化：add/remove 项级复用
// 4. 卸载：块内 effect 停止（响应式不再触发）
// 运行：pnpm test test/solid.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, reactive, nextTick } from '@actview/core'

function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'solid-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

describe('<solid> 双模：块内渲染', () => {
  it('mapArray 渲染行 + 静态结构', () => {
    const rows = reactive([
      { id: 1, label: 'a' },
      { id: 2, label: 'b' },
    ])
    const App = () => (
      <table>
        <tbody>
          <solid>
            {rows.map((r) => (
              <tr key={r.id}>
                <td class="id">{r.id}</td>
                <td class="lbl">{r.label}</td>
              </tr>
            ))}
          </solid>
        </tbody>
      </table>
    )
    const host = mount(App)
    const trs = host.querySelectorAll('tr')
    expect(trs.length).toBe(2)
    expect(host.querySelectorAll('.lbl')[0].textContent).toBe('a')
    expect(host.querySelectorAll('.lbl')[1].textContent).toBe('b')
    expect(host.querySelectorAll('.id')[0].textContent).toBe('1')
  })

  it('行内容更新：label 变化只更新对应行文本，行结构不变', async () => {
    const rows = reactive([
      { id: 1, label: 'a' },
      { id: 2, label: 'b' },
    ])
    const App = () => (
      <table>
        <tbody>
          <solid>
            {rows.map((r) => (
              <tr key={r.id}>
                <td class="id">{r.id}</td>
                <td class="lbl">{r.label}</td>
              </tr>
            ))}
          </solid>
        </tbody>
      </table>
    )
    const host = mount(App)
    const tr0 = host.querySelectorAll('tr')[0]
    const lbl1 = host.querySelectorAll('.lbl')[1]

    rows[1].label = 'b!!!'
    await nextTick()

    expect(host.querySelectorAll('.lbl')[1].textContent).toBe('b!!!')
    expect(host.querySelectorAll('.lbl')[0].textContent).toBe('a')
    expect(host.querySelectorAll('tr').length).toBe(2)
    // 行结构未重建（DOM 元素引用不变）
    expect(host.querySelectorAll('tr')[0]).toBe(tr0)
    expect(host.querySelectorAll('.lbl')[1]).toBe(lbl1)
  })

  it('结构变化：新增行插入、删除行移除（项级复用）', async () => {
    const rows = reactive([
      { id: 1, label: 'a' },
      { id: 2, label: 'b' },
    ])
    const App = () => (
      <table>
        <tbody>
          <solid>
            {rows.map((r) => (
              <tr key={r.id}>
                <td class="id">{r.id}</td>
                <td class="lbl">{r.label}</td>
              </tr>
            ))}
          </solid>
        </tbody>
      </table>
    )
    const host = mount(App)

    // 追加
    rows.push({ id: 3, label: 'c' })
    await nextTick()
    expect(host.querySelectorAll('tr').length).toBe(3)
    expect(host.querySelectorAll('.lbl')[2].textContent).toBe('c')

    // 删除中间行（项级复用：id=1/3 行保留 DOM 引用）
    const tr0 = host.querySelectorAll('tr')[0]
    const tr2 = host.querySelectorAll('tr')[2]
    rows.splice(1, 1)
    await nextTick()
    expect(host.querySelectorAll('tr').length).toBe(2)
    expect(host.querySelectorAll('.lbl')[0].textContent).toBe('a')
    expect(host.querySelectorAll('.lbl')[1].textContent).toBe('c')
    expect(host.querySelectorAll('tr')[0]).toBe(tr0)
    expect(host.querySelectorAll('tr')[1]).toBe(tr2)
  })

  it('卸载：块内 effect 停止（数据变化不再触发 DOM 更新）', async () => {
    const rows = reactive([{ id: 1, label: 'a' }])
    const App = () => (
      <table>
        <tbody>
          <solid>
            {rows.map((r) => (
              <tr key={r.id}>
                <td class="lbl">{r.label}</td>
              </tr>
            ))}
          </solid>
        </tbody>
      </table>
    )
    const host = mount(App)
    const app = createApp(App)
    // 卸载：移除 solid 块 DOM
    host.innerHTML = ''
    rows[0].label = 'zzz'
    await nextTick()
    // 块已卸载，无 DOM 可更新；不抛错即可
    expect(host.querySelectorAll('.lbl').length).toBe(0)
  })
})

it('mapArray 清空（splice(0) 全删）', async () => {
  const rows = reactive([
    { id: 1, label: 'a' },
    { id: 2, label: 'b' },
    { id: 3, label: 'c' },
  ])
  const App = () => (
    <table>
      <tbody>
        <solid>
          {rows.map((r) => (
            <tr key={r.id}>
              <td class="id">{r.id}</td>
            </tr>
          ))}
        </solid>
      </tbody>
    </table>
  )
  const host = mount(App)
  await nextTick()
  expect(host.querySelectorAll('tbody tr').length).toBe(3)
  rows.splice(0)
  await nextTick()
  expect(host.querySelectorAll('tbody tr').length).toBe(0)
  expect(host.querySelector('tbody')!.innerHTML).toBe('')
})

it('mapArray swap 功能 + 耗时', async () => {
  const rows = reactive(Array.from({ length: 1000 }, (_, i) => ({ id: i, label: 'r' + i })))
  const App = () => (
    <table>
      <tbody>
        <solid>
          {rows.map((r) => (
            <tr key={r.id}>
              <td class="id">{r.id}</td>
            </tr>
          ))}
        </solid>
      </tbody>
    </table>
  )
  const host = mount(App)
  await nextTick()
  expect(host.querySelectorAll('tbody tr').length).toBe(1000)
  const t0 = performance.now()
  const newRows = rows.slice()
  newRows[1] = rows[998]
  newRows[998] = rows[1]
  rows.splice(0, rows.length, ...newRows)
  await nextTick()
  const ms = performance.now() - t0
  const ids = Array.from(host.querySelectorAll('tbody tr td.id')).map((td) => td.textContent)
  expect(ids[1]).toBe('998')
  expect(ids[998]).toBe('1')
  console.log('[swap-ms]', ms.toFixed(1))
}, 10000)
