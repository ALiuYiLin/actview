// ============================================================
// @actview/server Phase 4：SSR + router
// ============================================================

import { describe, expect, it } from 'vitest'
import { ActViewComponent, Component, Prop, nextTick } from '@actview/core'
import {
  RouterView,
  createMemoryHistory,
  createRouter,
} from '@actview/router'
import { createSSRApp } from '../src/index'

@Component({ name: 'Home' })
class Home extends ActViewComponent {
  render() {
    return <span>home</span>
  }
}

@Component({ name: 'User' })
class User extends ActViewComponent<{ id: string }> {
  @Prop
  id = ''

  render() {
    return <span>user:{this.id}</span>
  }
}

let loadedUser = ''

@Component({ name: 'Loaded' })
class Loaded extends ActViewComponent {
  render() {
    return <span>loaded:{loadedUser}</span>
  }
}

@Component({ name: 'App' })
class App extends ActViewComponent {
  render() {
    return (
      <main>
        <RouterView />
      </main>
    )
  }
}

describe('@actview/server：SSR + router', () => {
  it('memory history 初始路由 / 参数', async () => {
    const router = createRouter({
      history: createMemoryHistory('/user/42'),
      routes: [
        { path: '/', component: Home },
        { path: '/user/:id', component: User, props: true },
      ],
    })

    const app = createSSRApp(App)
    app.use(router)
    const html = await app.renderToString()

    expect(html).toContain('<main>')
    expect(html).toContain('user:42')
  })

  it('服务端渲染前 push + guards 生效', async () => {
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [{ path: '/', component: Home }],
    })
    router.beforeEach(async (to) => {
      if (to.path === '/user/7') return false
    })

    const app = createSSRApp(App)
    app.use(router)
    await router.push('/user/7')
    const html = await app.renderToString()

    expect(html).toContain('home')
    expect(html).not.toContain('user:7')
  })

  it('router HTML 可以在客户端 hydrate', async () => {
    const makeRouter = () =>
      createRouter({
        history: createMemoryHistory('/user/42'),
        routes: [
          { path: '/', component: Home },
          { path: '/user/:id', component: User, props: true },
        ],
      })

    const serverApp = createSSRApp(App)
    serverApp.use(makeRouter())
    const html = await serverApp.renderToString()

    const root = document.createElement('div')
    root.innerHTML = html
    document.body.appendChild(root)
    const original = root.querySelector('span')!

    const clientApp = createSSRApp(App)
    clientApp.use(makeRouter())
    clientApp.hydrate(root)
    await nextTick()

    expect(root.querySelector('span')).toBe(original)
    expect(root.textContent).toBe('user:42')
  })

  it('route loader 在 SSR navigate 时预取数据', async () => {
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        { path: '/', component: Home },
        {
          path: '/loaded',
          component: Loaded,
          loader: async () => {
            await Promise.resolve()
            loadedUser = 'Ada'
          },
        },
      ],
    })

    const app = createSSRApp(App)
    app.use(router)
    const result = await router.push('/loaded')
    expect(result.ok).toBe(true)

    const html = await app.renderToString()
    expect(html).toContain('loaded:Ada')
  })
})
