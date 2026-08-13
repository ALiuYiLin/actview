// ============================================================
// @actview/router 进阶能力验收测试（vitest + happy-dom）
//   覆盖：嵌套路由（children + 嵌套 RouterView）、导航守卫
//   （beforeEach/afterEach/beforeEnter）、redirect、懒加载组件
// 运行：pnpm test
// ============================================================

import { describe, it, expect } from 'vitest'
import { createApp, nextTick, Suspense } from 'actview'
import {
  createRouter,
  createMemoryHistory,
  RouterLink,
  RouterView
} from '@actview/router'

/** 等所有微任务 + 宏任务（含异步守卫 Promise 链） */
const flush = () => new Promise((r) => setTimeout(r, 0))

let mountSeq = 0
function mount(component: any) {
  const host = document.createElement('div')
  host.id = 'router-host-' + mountSeq++
  document.body.appendChild(host)
  createApp(component).mount('#' + host.id)
  return host
}

function collectText(el: any): string {
  if (el == null) return ''
  if (el.nodeType === 3) return el.textContent ?? ''
  return Array.from(el.childNodes).map(collectText).join('')
}

// ------------------------------------------------------------
// 嵌套路由
// ------------------------------------------------------------
describe('路由：嵌套路由', () => {
  it('children + 嵌套 RouterView 渲染匹配链各层组件', async () => {
    function User(props: any) {
      return <div class="user">User {props.params.id} <RouterView /></div>
    }
    function Profile() {
      return <div class="profile">Profile</div>
    }
    function Posts() {
      return <div class="posts">Posts</div>
    }
    const router = createRouter({
      history: createMemoryHistory('/user/1/profile'),
      routes: [
        {
          path: '/user/:id',
          component: User,
          children: [
            { path: 'profile', component: Profile },
            { path: 'posts', component: Posts }
          ]
        }
      ]
    })
    function App() {
      return <RouterView />
    }
    const host = mount(App)
    await nextTick()
    expect(collectText(host)).toContain('User 1')
    expect(collectText(host)).toContain('Profile')

    router.push('/user/2/posts')
    await nextTick()
    expect(collectText(host)).toContain('User 2')
    expect(collectText(host)).toContain('Posts')
    expect(collectText(host)).not.toContain('Profile')
  })
})

// ------------------------------------------------------------
// 导航守卫
// ------------------------------------------------------------
describe('路由：导航守卫', () => {
  it('beforeEach 返回 false 取消导航', async () => {
    function Home() {
      return <div class="home">Home</div>
    }
    function Secret() {
      return <div class="secret">Secret</div>
    }
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        { path: '/', component: Home },
        { path: '/secret', component: Secret }
      ]
    })
    router.beforeEach((to: any) => {
      if (to.path === '/secret') return false
    })
    router.push('/secret')
    await flush()
    expect(router.currentRoute.path).toBe('/')
  })

  it('beforeEach 返回重定向目标', async () => {
    function Home() {
      return <div class="home">Home</div>
    }
    function New() {
      return <div class="new">New</div>
    }
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        { path: '/', component: Home },
        { path: '/new', component: New }
      ]
    })
    router.beforeEach((to: any) => {
      if (to.path === '/old') return '/new'
    })
    router.push('/old')
    await flush()
    expect(router.currentRoute.path).toBe('/new')
  })

  it('beforeEach 异步守卫（Promise）', async () => {
    function Home() {
      return <div class="home">Home</div>
    }
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [{ path: '/', component: Home }]
    })
    const order: string[] = []
    router.beforeEach(async () => {
      order.push('guard-start')
      await Promise.resolve()
      order.push('guard-end')
    })
    router.push('/x')
    await flush()
    expect(order).toEqual(['guard-start', 'guard-end'])
  })

  it('路由级 beforeEnter', async () => {
    function Home() {
      return <div class="home">Home</div>
    }
    function Guarded() {
      return <div class="guarded">Guarded</div>
    }
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        { path: '/', component: Home },
        {
          path: '/guarded',
          component: Guarded,
          beforeEnter: () => false
        }
      ]
    })
    router.push('/guarded')
    await flush()
    expect(router.currentRoute.path).toBe('/')
  })

  it('afterEach 后置钩子', async () => {
    function Home() {
      return <div class="home">Home</div>
    }
    function About() {
      return <div class="about">About</div>
    }
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        { path: '/', component: Home },
        { path: '/about', component: About }
      ]
    })
    const log: string[] = []
    router.afterEach((to: any) => log.push(to.path))
    router.push('/about')
    await flush()
    expect(log).toContain('/about')
  })
})

// ------------------------------------------------------------
// redirect + 懒加载
// ------------------------------------------------------------
describe('路由：redirect + 懒加载', () => {
  it('叶子路由 redirect', async () => {
    function Home() {
      return <div class="home">Home</div>
    }
    function Target() {
      return <div class="target">Target</div>
    }
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        { path: '/', component: Home },
        { path: '/target', component: Target },
        { path: '/old', redirect: '/target' }
      ]
    })
    router.push('/old')
    await flush()
    expect(router.currentRoute.path).toBe('/target')
  })

  it('component: () => Promise 懒加载（配合 Suspense）', async () => {
    function LazyComp() {
      return <div class="lazy">Lazy loaded</div>
    }
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        {
          path: '/',
          component: () => Promise.resolve({ default: LazyComp })
        }
      ]
    })
    function App() {
      return (
        <Suspense fallback={<div class="loading">loading</div>}>
          <RouterView />
        </Suspense>
      )
    }
    const host = mount(App)
    await flush()
    expect(collectText(host)).toContain('Lazy loaded')
  })
})
