// ============================================================
// @actview/router — RouterView / RouterLink
// ============================================================

import {
  ActViewComponent,
  Component,
  Inject,
  Prop,
  Provide,
  Setup,
  createElement,
  type ClassComponent,
} from '@actview/core'
import { routerKey, viewDepthKey, type Router } from './router'
import type {
  RouteLocationNormalized,
  RouteLocationRaw,
  RouteRecord,
} from './types'

@Component({ name: 'RouterView' })
export class RouterView extends ActViewComponent {
  @Inject(routerKey)
  router!: Router

  @Inject(viewDepthKey, 0)
  parentDepth!: number

  @Provide(viewDepthKey)
  nextDepth = 0

  @Setup
  setup(): void {
    this.nextDepth = this.parentDepth + 1
  }

  render() {
    if (!this.router) {
      throw new Error('[actview/router] RouterView 需要 app.use(router)')
    }
    const route = this.router.currentRoute
    const views = route.matched.filter((record) => record.component)
    const record = views[this.parentDepth]
    if (!record?.component) return null

    return createElement(
      record.component,
      resolveProps(record, route),
      `${route.path}:${this.parentDepth}`,
    )
  }
}

@Component({ name: 'RouterLink' })
export class RouterLink extends ActViewComponent {
  @Inject(routerKey)
  router!: Router

  @Prop
  to!: RouteLocationRaw

  @Prop
  replace = false

  @Prop
  activeClass = 'router-link-active'

  @Prop
  exactActiveClass = 'router-link-exact-active'

  @Prop
  ariaCurrentValue = 'page'

  render() {
    if (!this.router || this.to == null) return null

    const resolved = this.router.resolve(this.to)
    const current = this.router.currentRoute
    const exact = current.path === resolved.path
    const active =
      resolved.path === '/'
        ? exact
        : exact ||
          current.path.startsWith(
            resolved.path.endsWith('/') ? resolved.path : `${resolved.path}/`,
          )

    const classNames = [
      this.$props.class,
      active ? this.activeClass : null,
      exact ? this.exactActiveClass : null,
    ]

    return createElement('a', {
      href: resolved.fullPath,
      class: classNames,
      target: this.$props.target,
      'aria-current': exact ? this.ariaCurrentValue : undefined,
      onClick: (event: MouseEvent) => this.handleClick(event),
      children: this.$props.children,
    })
  }

  private handleClick(event: MouseEvent): void {
    if (event.defaultPrevented) return
    if (event.button !== 0) return
    if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return
    const target = this.$props.target
    if (target && target !== '_self') return

    event.preventDefault()
    const promise = this.replace
      ? this.router.replace(this.to)
      : this.router.push(this.to)
    void promise.catch((err) => {
      console.error('[actview/router] 导航失败：', err)
    })
  }
}

function resolveProps(
  record: RouteRecord,
  route: RouteLocationNormalized,
): Record<string, any> {
  const props = record.props
  if (props === true) return { ...route.params }
  if (typeof props === 'function') return props(route)
  if (props && typeof props === 'object') return { ...props }
  return {}
}

export type RouterViewComponent = ClassComponent<any>
