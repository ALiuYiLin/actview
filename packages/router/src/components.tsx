// ============================================================
// RouterLink / RouterView — 路由组件
//   RouterView 每次渲染时读取 reactive 的 currentRoute 并重新匹配，
//   路由变化 =》 RouterView effect 重跑 =》 匹配组件切换（patch replace）
// ============================================================

import { defineComponent } from '@local/core'
import { jsx } from '@local/jsx-factory'
import { currentRouter } from './router'

/** 渲染为 <a>，点击拦截默认跳转并走 router.push；style/class 等其余 props 透传 */
export function RouterLink(props: { to: string; children?: any; [key: string]: any }) {
  const { to, children, ...rest } = props
  return (
    <a href={to} {...rest} onclick={(e) => {
      e.preventDefault()
      currentRouter.push(to)
    }}>
      {children}
    </a>
  )
}

/**
 * 根据当前路由渲染匹配组件，并把 path/params/query 作为 props 传入。
 * 手写 defineComponent + render 闭包（而非依赖 Babel 转换）：
 * 匹配逻辑必须在「每次渲染」时执行（读 currentRoute 会收集依赖），
 * 若写在组件函数体（setup）里只会执行一次，组件切换将失效。
 */
export const RouterView = defineComponent(function () {
  return () => {
    const route = currentRouter.currentRoute
    const matched = currentRouter.match(route.path)
    if (!matched) return null
    const Component = matched.record.component
    return jsx(Component, {
      path: route.path,
      params: matched.params,
      query: route.query,
    })
  }
})
