// ============================================================
// createApp / mount / unmount（M1，docs/renderer.md）
//
// 应用对象持有 AppContext（config / app 反指 / provides 注入表），mount 时
// 创建根组件 VNode 并交给渲染器 render(vnode, container)；unmount 即
// render(null, container)。根组件必须是 @Component 类（带
// __actview_class_component 标记），裸 class / 函数直接报错。
//
// M2：
//   - app.provide(key, value)：写入 AppContext.provides（根组件 injects 初始表）；
//   - mount 返回根组件的公开实例 proxy（不是内部实例，内部实例经 proxy.$ 拿）。
// ============================================================

import { isComponent } from '../internal'
import type { ClassComponentCtor } from '../internal'
import { createVNode, type VNode } from '../internal'
import type {
  AppConfig,
  AppContext,
  ComponentInternalInstance,
  ComponentPublicInstance,
} from './instance'
import { render } from './patch'

/** 挂载过 app 的容器（重复 mount 检测标记） */
type MountedContainer = Element & { __actview_app__?: App }

/** createApp 返回的应用对象 */
export interface App {
  /** 应用上下文（全局 config 等） */
  _context: AppContext
  /** 当前挂载的容器；null = 未挂载 */
  _container: Element | null
  /** 应用配置（与 _context.config 同一对象） */
  config: AppConfig
  /** 根组件（@Component 类构造器） */
  component: ClassComponentCtor
  /**
   * 提供应用级注入值：写入 AppContext.provides（根组件的初始注入表），
   * 所有组件都能 inject 到。建议在 mount 之前调用（根组件 setup 时继承该表）。
   */
  provide<T>(key: PropertyKey, value: T): App
  /**
   * 挂载到容器（DOM Element 或选择器字符串），返回根组件【公开实例 proxy】；
   * 未挂载成功（根组件 render 异常等）为 null。内部实例经 proxy.$ 访问。
   */
  mount(rootContainer: Element | string): ComponentPublicInstance | null
  /** 卸载当前挂载的应用（移除 DOM 并停止响应式更新） */
  unmount(): void
}

/**
 * 创建应用。
 *
 * @param rootComponent 根组件（@Component 类构造器；运行时用 isComponent 严格校验）
 * @param rootProps 根组件 props
 */
export function createApp(
  rootComponent: ClassComponentCtor,
  rootProps: Record<string, any> | null = null,
): App {
  assertRootComponent(rootComponent)

  const context: AppContext = { app: null, config: {}, provides: {} }

  const app: App = {
    _context: context,
    _container: null,
    config: context.config,
    component: rootComponent,
    provide<T>(key: PropertyKey, value: T): App {
      context.provides[key] = value
      return app
    },
    mount(rootContainer) {
      assertRootComponent(app.component)

      const container = resolveContainer(rootContainer)
      const mounted = container as MountedContainer
      if (mounted.__actview_app__) {
        console.warn(
          '[actview] 容器已挂载过 ActView 应用：重复 mount 会覆盖容器上的 app 标记，' +
            '旧应用不会被自动卸载。',
        )
      }

      const vnode = createVNode(app.component, rootProps ?? null)
      // VNode 类型里没有 appContext 字段（渲染器内部状态，由 app 写入）
      ;(vnode as VNode & { appContext: AppContext }).appContext = context
      render(vnode, container)

      mounted.__actview_app__ = app
      app._container = container

      // 渲染器在 mountComponent 中把内部实例写回 vnode.component；
      // 对外返回公开实例 proxy（内部实例经 proxy.$ 访问）
      const instance = (vnode.component as unknown as
        | ComponentInternalInstance
        | null) ?? null
      return instance?.proxy ?? null
    },
    unmount() {
      const container = app._container as MountedContainer | null
      if (!container) return

      render(null, container)
      delete container.__actview_app__
      app._container = null
    },
  }

  context.app = app
  return app
}

/** 根组件运行时校验：必须是 @Component 类组件 */
function assertRootComponent(
  component: unknown,
): asserts component is ClassComponentCtor {
  if (!isComponent(component)) {
    throw new Error(
      '[actview] 根组件无效：需要 @Component 类组件（必须实现 render）' +
        `（当前为 ${typeof component}）`,
    )
  }
}

/** 解析挂载容器：选择器字符串 → document.querySelector；找不到时报错 */
function resolveContainer(rootContainer: Element | string): Element {
  if (typeof rootContainer === 'string') {
    const container = document.querySelector(rootContainer)
    if (!container) {
      throw new Error(`[actview] mount 失败：未找到容器 "${rootContainer}"`)
    }
    return container
  }
  if (!rootContainer) {
    throw new Error('[actview] mount 失败：容器不能为空')
  }
  return rootContainer
}
