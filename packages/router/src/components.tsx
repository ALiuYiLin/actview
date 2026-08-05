// ============================================================
// RouterLink / RouterView — 路由组件
//   RouterView 每次渲染时读取 reactive 的 currentRoute 并重新匹配，
//   路由变化 =》 RouterView effect 重跑 =》 匹配组件切换（patch replace）
//
// 注意：两个组件均手写 defineComponent + render 闭包，不依赖 Babel 插件
// 转换——发布构建（tsup）没有编译期插件，JSX 语法无法被转成组件。
// ============================================================

import { defineComponent } from '@actview/core'
import { jsx } from '@actview/jsx'
import { currentRouter } from './router'

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
 * 根据当前路由渲染匹配组件，并把 path/params/query 作为 props 传入。
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
      query: route.query
    })
  }
})
