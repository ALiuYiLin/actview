// ============================================================
// 复现：core `unmount` 只递归组件 subTree 一层——
//   组件嵌套在原生元素 / Fragment / Teleport 里时，根卸载不会
//   触发嵌套组件的 onUnmounted（生命周期泄漏：浮动层清理、
//   portal node 移除等不执行）。
// 运行：pnpm exec vitest run test/renderer/unmount-recursive.test.tsx
// ============================================================

import { describe, it, expect } from 'vitest'
import {
  render,
  unmount,
  defineComponent,
  onUnmounted,
  Teleport,
} from '@actview/core'

function mountApp(component: any) {
  const host = document.createElement('div')
  host.id = 'ur-host-' + Math.random().toString(36).slice(2)
  document.body.appendChild(host)
  const vnode = {
    $$typeof: Symbol.for('react.element'),
    type: component,
    key: null,
    ref: null,
    props: {},
  }
  render(vnode, host)
  return { host, vnode }
}

describe('unmount 递归（组件生命周期）', () => {
  it('组件嵌套在原生元素里：根卸载触发其 onUnmounted', () => {
    let unmounted = 0
    const Inner = defineComponent(function () {
      onUnmounted(() => {
        unmounted++
      })
      return () => <div id="inner">I</div>
    })
    const App = defineComponent(function () {
      return () => (
        <div id="outer">
          <Inner />
        </div>
      )
    })
    const { host, vnode } = mountApp(App)
    expect(host.querySelector('#inner')).toBeTruthy()
    unmount(vnode, host)
    expect(unmounted).toBe(1) // 复现：当前只递归一层 → 0
    expect(host.querySelector('#outer')).toBeNull() // DOM 仍应移除
    host.remove()
  })

  it('组件嵌套在 Fragment 里：根卸载触发其 onUnmounted', () => {
    let unmounted = 0
    const Inner = defineComponent(function () {
      onUnmounted(() => {
        unmounted++
      })
      return () => <div id="inner">I</div>
    })
    const App = defineComponent(function () {
      return () => (
        <>
          <span id="sib">S</span>
          <Inner />
        </>
      )
    })
    const { host, vnode } = mountApp(App)
    expect(host.querySelector('#inner')).toBeTruthy()
    unmount(vnode, host)
    expect(unmounted).toBe(1)
    expect(host.childNodes.length).toBe(0)
    host.remove()
  })

  it('组件嵌套在多层原生元素里：深层 onUnmounted 也触发', () => {
    let unmounted = 0
    const Inner = defineComponent(function () {
      onUnmounted(() => {
        unmounted++
      })
      return () => <div id="inner">I</div>
    })
    const App = defineComponent(function () {
      return () => (
        <div id="l1">
          <section id="l2">
            <Inner />
          </section>
        </div>
      )
    })
    const { host, vnode } = mountApp(App)
    expect(host.querySelector('#inner')).toBeTruthy()
    unmount(vnode, host)
    expect(unmounted).toBe(1)
    expect(host.querySelector('#l1')).toBeNull()
    host.remove()
  })

  it('组件在 Teleport 里：根卸载触发其 onUnmounted 并移除目标容器内容', () => {
    let unmounted = 0
    const target = document.createElement('div')
    target.id = 'tp-target'
    document.body.appendChild(target)
    const Inner = defineComponent(function () {
      onUnmounted(() => {
        unmounted++
      })
      return () => <div id="inner">I</div>
    })
    const App = defineComponent(function () {
      return () => (
        <Teleport to={target}>
          <Inner />
        </Teleport>
      )
    })
    const { host, vnode } = mountApp(App)
    expect(target.querySelector('#inner')).toBeTruthy()
    unmount(vnode, host)
    expect(unmounted).toBe(1) // 复现：unmountTeleport 不递归组件 → 0
    expect(target.querySelector('#inner')).toBeNull()
    target.remove()
    host.remove()
  })

  it('onUnmounted 只触发一次（递归不双跑）', () => {
    let unmounted = 0
    const Inner = defineComponent(function () {
      onUnmounted(() => {
        unmounted++
      })
      return () => <div id="inner">I</div>
    })
    const App = defineComponent(function () {
      return () => (
        <div id="outer">
          <div id="wrap">
            <Inner />
          </div>
        </div>
      )
    })
    const { host, vnode } = mountApp(App)
    unmount(vnode, host)
    expect(unmounted).toBe(1) // 递归各层只触发一次
    host.remove()
  })
})
