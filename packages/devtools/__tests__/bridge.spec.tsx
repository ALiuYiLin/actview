// ============================================================
// @actview/devtools — page ↔ extension bridge
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import {
  ActViewComponent,
  Component,
  Ref,
  createApp,
} from '@actview/core'
import {
  devtoolsPlugin,
  resetDevtoolsBackend,
  stopDevtoolsBridge,
} from '../src/index'

function mountRoot(): HTMLElement {
  const root = document.createElement('div')
  document.body.appendChild(root)
  return root
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

afterEach(() => {
  stopDevtoolsBridge()
  resetDevtoolsBackend()
  document.body.innerHTML = ''
})

describe('@actview/devtools：bridge', () => {
  it('发送 snapshot / state，并处理 highlight 命令', async () => {
    @Component({ name: 'BridgeApp' })
    class BridgeApp extends ActViewComponent {
      @Ref
      count = 0

      render() {
        return (
          <div id="bridge-root">
            <span>{this.count}</span>
          </div>
        )
      }
    }

    const messages: any[] = []
    const onMessage = (event: MessageEvent) => {
      if (event.data?.source === 'actview-devtools-page') {
        messages.push(event.data)
      }
    }
    window.addEventListener('message', onMessage)

    const app = createApp(BridgeApp)
    app.use(devtoolsPlugin, { appName: 'Bridge' })
    app.mount(mountRoot())
    await sleep(40)

    const snapshot = messages
      .filter((message) => message.type === 'snapshot')
      .at(-1)
    expect(snapshot).toBeTruthy()
    expect(snapshot.payload.apps[0].name).toBe('Bridge')
    const component = snapshot.payload.components.find(
      (item: any) => item.name === 'BridgeApp',
    )
    expect(component).toBeTruthy()

    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        data: {
          source: 'actview-devtools-content',
          type: 'getState',
          payload: { id: component.id },
        },
      }),
    )
    await sleep(20)
    const state = messages.find((message) => message.type === 'state')
    expect(state.payload.state.name).toBe('BridgeApp')
    expect(state.payload.state.state.count).toBe(0)

    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        data: {
          source: 'actview-devtools-content',
          type: 'highlight',
          payload: { id: component.id },
        },
      }),
    )
    expect(
      document.getElementById('__actview_devtools_highlight__'),
    ).toBeTruthy()

    app.unmount()
    window.removeEventListener('message', onMessage)
  })
})
