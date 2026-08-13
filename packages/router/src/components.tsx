// ============================================================
// RouterLink / RouterView — 路由组件
//   RouterView 每次渲染时读取 reactive 的 currentRoute 并重新匹配，
//   路由变化 =》 RouterView effect 重跑 =》 匹配组件切换（patch replace）
//   嵌套：RouterView 通过 provide/inject 传递深度（routerViewDepth），
//   第 n 层 RouterView 渲染匹配链第 n 项
//   懒加载：component 为函数（() => import()）时用 lazy 包装，配合 Suspense
//
// 注意：两个组件均手写 defineComponent + render 闭包，不依赖 Babel 插件
// 转换——发布构建（tsup）没有编译期插件，JSX 语法无法被转成组件。
// ============================================================

import { defineComponent, provide, lazy } from '@actview/core'
import { jsx } from '@actview/jsx'
import { currentRouter } from './router'

const ROUTER_VIEW_DEPTH = 'routerViewDepth'

/** 懒加载组件缓存：同一个 loader 函数只创建一次 lazy 组件（避免反复触发 Suspense） */
const lazyCache = new Map<any, any>()
function resolveComponent(component: any) {
  if (typeof component !== 'function') return component
  if (!lazyCache.has(component)) {
    lazyCache.set(component, lazy(component))
  }
  return lazyCache.get(component)
}

/** 渲染为 <a>，点击拦截默认跳转并走 router.push；style/class 等其余 props 透传 */
export const RouterLink = defineComponent(function (props: any) {
  return () => {
    const { to, children, ...rest } = props
    return jsx('a', {
      href: to,
      ...rest,
      onclick: (e: MouseEvent) => {
        e.preventDefault()
        currentRouter.push(to)
      },
      children
    })
  }
})

/**
 * 根据当前路由渲染匹配链中「对应深度」的组件，并把 path/params/query 作为 props 传入。
 * 匹配逻辑必须在「每次渲染」时执行（读 currentRoute 会收集依赖）。
 * 嵌套：setup 里读父 RouterView provide 的深度 +1，并 provide 给子组件。
 */
export const RouterView = defineComponent(function (_props: any, ctx?: any) {
  const depth = ((ctx?.injects?.[ROUTER_VIEW_DEPTH] ?? -1) + 1) as number
  provide(ROUTER_VIEW_DEPTH, depth)

  return () => {
    const route = currentRouter.currentRoute
    const matched = route.matched
    if (!matched || matched.length === 0 || depth >= matched.length) return null
    const record = matched[depth].record
    if (!record || !record.component) return null
    // 懒加载：component 为函数（() => import()）时用 lazy 包装（缓存，配合 Suspense）
    const Component = resolveComponent(record.component)
    return jsx(Component, {
      path: route.path,
      params: matched[depth].params,
      query: route.query
    })
  }
})
