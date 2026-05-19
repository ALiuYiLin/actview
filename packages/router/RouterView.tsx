import { useRouter } from './router'

/**
 * <RouterView /> 组件 — 类似 Vue 的 <router-view>
 *
 * 自动渲染当前路由链中对应深度的组件。
 * 嵌套使用时，自动匹配 matched 数组中的下一层级。
 *
 * @example
 * // 一级路由
 * <RouterView />
 *
 * // 嵌套路由（父布局组件内，自动识别嵌套层级）
 * function Layout() {
 *   return () => (
 *     <div>
 *       <nav>...</nav>
 *       <RouterView />   // 自动渲染 matched[1]
 *     </div>
 *   )
 * }
 */
export function RouterView() {
  const router = useRouter()

  return () => {
    const depth = router.getCurrentDepth()
    const matched = router.matched.value
    const route = matched[depth]
    if (!route) return <span></span>

    router.pushDepth()
    const Component = route.component as any
    const result = <Component />
    router.popDepth()
    return result
  }
}
