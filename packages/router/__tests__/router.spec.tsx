// ============================================================
// @actview/router 验收
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ActViewComponent,
  Component,
  Inject,
  Prop,
  createApp,
  nextTick,
} from '@actview/core'
import {
  RouterLink,
  RouterView,
  createMemoryHistory,
  createRouter,
  routerKey,
  type Router,
} from '../src/index'

function mountRoot(): HTMLElement {
  const root = document.createElement('div')
  document.body.appendChild(root)
  return root
}

async function flush(times = 8): Promise<void> {
  for (let i = 0; i < times; i++) await nextTick()
}

afterEach(() => {
  document.body.innerHTML = ''
})

@Component({ name: 'Home' })
class Home extends ActViewComponent {
  render() {
    return <span>home</span>
  }
}

@Component({ name: 'User' })
class User extends ActViewComponent {
  @Prop
  id = ''

  render() {
    return <span>user:{this.id}</span>
  }
}

@Component({ name: 'App' })
class App extends ActViewComponent {
  render() {
    return (
      <div>
        <RouterLink to="/user/7">user7</RouterLink>
        <RouterView />
      </div>
    )
  }
}

describe('@actview/router', () => {
  it('RouterView：初始路由与 push 参数', async () => {
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        { path: '/', component: Home },
        { path: '/user/:id', component: User, props: true },
      ],
    })

    const root = mountRoot()
    createApp(App).use(router).mount(root)
    await nextTick()
    expect(root.textContent).toContain('home')

    await router.push('/user/42')
    await nextTick()
    expect(root.textContent).toContain('user:42')
    expect(router.currentRoute.params.id).toBe('42')
  })

  it('RouterLink：href / 点击导航 / 参数', async () => {
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        { path: '/', component: Home },
        { path: '/user/:id', component: User, props: true },
      ],
    })

    const root = mountRoot()
    createApp(App).use(router).mount(root)
    await nextTick()

    const link = root.querySelector('a')!
    expect(link.getAttribute('href')).toBe('/user/7')

    link.dispatchEvent(
      new MouseEvent('click', { button: 0, bubbles: true, cancelable: true }),
    )
    await flush()
    expect(root.textContent).toContain('user:7')
    expect(router.currentRoute.path).toBe('/user/7')
  })

  it('嵌套路由：父 RouterView + 子 RouterView', async () => {
    @Component({ name: 'Layout' })
    class Layout extends ActViewComponent {
      render() {
        return (
          <section>
            <span>layout</span>
            <RouterView />
          </section>
        )
      }
    }

    @Component({ name: 'Child' })
    class Child extends ActViewComponent {
      render() {
        return <span>child</span>
      }
    }

    const router = createRouter({
      history: createMemoryHistory('/parent/child'),
      routes: [
        {
          path: '/parent',
          component: Layout,
          children: [{ path: 'child', component: Child }],
        },
      ],
    })

    const root = mountRoot()
    createApp(App).use(router).mount(root)
    await nextTick()
    expect(root.textContent).toContain('layout')
    expect(root.textContent).toContain('child')
  })

  it('全局 beforeEach：false 中止；route beforeEnter 重定向', async () => {
    @Component({ name: 'Blocked' })
    class Blocked extends ActViewComponent {
      render() {
        return <span>blocked</span>
      }
    }

    @Component({ name: 'Login' })
    class Login extends ActViewComponent {
      render() {
        return <span>login</span>
      }
    }

    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        { path: '/', component: Home },
        { path: '/blocked', component: Blocked },
        {
          path: '/private',
          component: Blocked,
          beforeEnter: () => '/login',
        },
        { path: '/old', redirect: '/login' },
        { path: '/login', component: Login },
      ],
    })
    router.beforeEach((to) => (to.path === '/blocked' ? false : true))

    const root = mountRoot()
    createApp(App).use(router).mount(root)
    await nextTick()

    const aborted = await router.push('/blocked')
    expect(aborted.aborted).toBe(true)
    expect(router.currentRoute.path).toBe('/')

    await router.push('/private')
    await nextTick()
    expect(router.currentRoute.path).toBe('/login')
    expect(root.textContent).toContain('login')

    await router.push('/old')
    await nextTick()
    expect(router.currentRoute.path).toBe('/login')
  })

  it('路由级 lazy loader', async () => {
    @Component({ name: 'LazyPage' })
    class LazyPage extends ActViewComponent {
      render() {
        return <span>lazy</span>
      }
    }

    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        { path: '/', component: Home },
        {
          path: '/lazy',
          component: () => Promise.resolve({ default: LazyPage }),
        },
      ],
    })

    const root = mountRoot()
    createApp(App).use(router).mount(root)
    await nextTick()

    await router.push('/lazy')
    await flush()
    expect(root.textContent).toContain('lazy')
  })

  it('resolve：query / hash / 命名路由', () => {
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        { path: '/', component: Home },
        { path: '/user/:id', name: 'user', component: User, props: true },
      ],
    })

    const resolved = router.resolve({
      name: 'user',
      params: { id: 9 },
      query: { tab: 'profile' },
      hash: 'info',
    })
    expect(resolved.path).toBe('/user/9')
    expect(resolved.fullPath).toBe('/user/9?tab=profile#info')
    expect(resolved.params.id).toBe('9')
  })

  it('RouterView 需要 router 注入', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const root = mountRoot()
    expect(() => createApp(App).mount(root)).toThrow(/app.use\(router\)/)
    errorSpy.mockRestore()
  })

  it('Router/currentRoute 可用于组件注入', () => {
    @Component({ name: 'Probe' })
    class Probe extends ActViewComponent {
      @Inject(routerKey)
      router!: Router

      render() {
        return <span>{this.router.currentRoute.path}</span>
      }
    }

    @Component({ name: 'ProbeApp' })
    class ProbeApp extends ActViewComponent {
      render() {
        return <Probe />
      }
    }

    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [{ path: '/', component: Home }],
    })
    const root = mountRoot()
    createApp(ProbeApp).use(router).mount(root)
    expect(root.textContent).toBe('/')
  })
})
