// ============================================================
// actview v2 — Vue 引擎 + React 语义 JSX
//
//   运行时全部来自 vue 官方包（re-export，零自研）：
//     响应式 / 调度 / patch / diff / 内置组件 / hydration / SSR
//
//   React 对齐层（本文件）：
//     - defineComponent：桥接 ctx.slots → props.children
//     - createContext：React 语义，基于 vue provide/inject
//     - JSX 编译：@actview/plugin-jsx（className/htmlFor/onChange 映射）
//
//   v1（自研 core）已冻结归档，见 docs/architecture-v2-vue-base.md
// ============================================================

import type { Reactive, SetupContext, VNode as VueVNode } from 'vue'

// ---------- reactivity（vue 官方） ----------
export {
  ref,
  shallowRef,
  triggerRef,
  isRef,
  unref,
  toValue,
  toRef,
  toRefs,
  reactive,
  shallowReactive,
  readonly,
  shallowReadonly,
  markRaw,
  toRaw,
  isReactive,
  isReadonly,
  isProxy,
  isShallow,
  computed,
  customRef,
  proxyRefs,
  watch,
  watchEffect,
  watchPostEffect,
  watchSyncEffect,
  onWatcherCleanup,
  effectScope,
  getCurrentScope,
  onScopeDispose,
  EffectScope,
} from 'vue'
export type {
  Ref,
  ComputedRef,
  WritableComputedRef,
  DeepReadonly,
  Reactive,
  ShallowReactive,
  ShallowRef,
  WatchSource,
  WatchOptions,
  WatchCallback,
  EffectScope as EffectScopeType,
} from 'vue'

// ---------- runtime（vue 官方） ----------
export {
  createApp,
  nextTick,
  h,
  cloneVNode,
  mergeProps,
  isVNode,
  withDirectives,
  Fragment,
  Text,
  Comment,
  Static,
  KeepAlive,
  Teleport,
  Transition,
  TransitionGroup,
  defineAsyncComponent,
  onBeforeMount,
  onMounted,
  onUpdated,
  onBeforeUnmount,
  onUnmounted,
  onActivated,
  onDeactivated,
  onErrorCaptured,
  onServerPrefetch,
  onRenderTracked,
  onRenderTriggered,
  provide,
  inject,
  getCurrentInstance,
  useId,
  useAttrs,
  useSlots,
  useTemplateRef,
  resolveComponent,
  resolveDirective,
  version,
} from 'vue'
export type {
  Component,
  DefineComponent,
  SetupContext,
  App,
  Plugin,
  VNode,
  VNodeChild,
  VNodeTypes,
  InjectionKey,
  ComponentPublicInstance,
  RenderFunction,
  Slot,
  Slots,
  PropType,
  EmitsOptions,
} from 'vue'

// ============================================================
// defineComponent — attrs 兜底 + slots 表暴露（vue 原生子内容语义）
//
//   Vue 模型：子内容在 ctx.slots（延迟函数），组件内 props.slots.default()
//   在 render 期调用（依赖追踪正常）；具名插槽 props.slots.header() 等。
//   ⚠️ 无 props.children 桥接（v2.1 起废弃）：读时求值 slots 会丢失
//      渲染上下文（「Slot invoked outside of render function」警告）、
//      展开污染 vnode props——统一用 vue 原生 slots。
// ============================================================
import {
  createVNode as vueCreateVNode,
  defineComponent as vueDefineComponent,
  Fragment as _Fragment,
  h,
  inject,
  isVNode,
  provide,
  Suspense as VueSuspense,
} from 'vue'

// ============================================================
// createVNode 包装（React 对齐：props.children → 第三参）
//
//   vue 的 vnode 结构：子节点在第三参（h(type, props, children)），
//   props 里的 children 键不是合法子节点（patch 时当 DOM 属性设置失败）。
//   React 的 children 就在 props 里——为对齐 React 语义（<p {...props}>
//   展开时 children 进三参），运行时规范化：
//     children == null && props 含 children 键 → 抽出作第三参 + 删键
//   另对齐 h()：单个 vnode children 包成数组（createVNode 原生不
//   normalize，单个 vnode 会被当 slots 处理）。
//   JSX 显式 children（第三参非 null）优先，不抽。
//   ⚠️ 只影响「props 显式含 children 键」的场景（vue 正常产物无此键）——
//      零干扰；代价是每次调用多一次 in 检查。
//
//   插槽求值深度（渲染期判定扩展）：组件 JSX children 会被插件转成
//   惰性插槽对象 { default: () => [...] }——插槽函数在【组件子树渲染
//   时】才执行，此时创建 vnode 的组件早已结束自身 render（词法标记
//   失效），桥接的 props.children 读取会被误判为「非渲染期」。这里把
//   插槽函数包一层深度计数：插槽求值期间 activeRenderDepth > 0，
//   桥接 children 读取视为渲染期（React 语义：JSX 子内容即渲染内容）。
// ============================================================
let activeRenderDepth = 0

function wrapSlots(children: any): any {
  if (
    children &&
    typeof children === 'object' &&
    !Array.isArray(children) &&
    !isVNode(children)
  ) {
    for (const k in children) {
      const fn = children[k]
      if (typeof fn === 'function') {
        children[k] = (...args: any[]) => {
          activeRenderDepth++
          try {
            return fn(...args)
          } finally {
            activeRenderDepth--
          }
        }
      }
    }
  }
  return children
}

export function createVNode(type: any, props: any, children?: any): VueVNode {
  if (props && 'children' in props) {
    if (children == null) {
      children = props.children
    }
    // 无论是否抽出都删键：残留的 children 键会被 patch 当 DOM 属性设置
    //（「Failed setting prop children」警告）；JSX 显式 children（第三参）
    // 优先，不覆盖
    delete props.children
  }
  if (children != null && !Array.isArray(children) && isVNode(children)) {
    children = [children]
  }
  return vueCreateVNode(type, props, wrapSlots(children))
}

// ============================================================
// Suspense — React 语义桥接（fallback prop → vue #fallback 插槽）
//
//   React 写法 <Suspense fallback={<X />}>children</Suspense>：
//   vue 的 Suspense 用 #fallback 具名插槽（fallback 不是 prop）。
//   桥接组件把 props.fallback（vnode）接到 #fallback 插槽，children
//   走默认插槽——React 语义 JSX 直接可用；其余 props（onResolve /
//   onPending / onFallback / timeout 等）透传给 vue Suspense。
// ============================================================
export interface SuspenseProps {
  /** React 语义：异步解析期间显示的 fallback（桥接为 vue #fallback 插槽） */
  fallback?: any
  /** vue 原生插槽（默认插槽 props.slots.default()） */
  slots?: any
  /** 其余透传：vue Suspense 事件/选项 */
  [key: string]: any
}

export const Suspense = defineComponent(function (
  props: SuspenseProps,
) {
  return () => {
    const { fallback, ...rest } = props as any
    return h(VueSuspense, rest, {
      default: () => props.slots?.default?.() ?? [],
      fallback: () => (fallback != null ? fallback : []),
    })
  }
}, 'ActViewSuspense')

/**
 * v2 组件类型（类型层形状）：
 * 运行时是 vue DefineComponent（createApp/渲染消费），但类型层用自定义形状
 * ——只有 call signature、无构造签名。TS 6 的 JSX 检查（getJsxReferenceKind）
 * 按「构造签名 → Component 路径（$props 宽松）/ 调用签名 → Function 路径
 * （props = 参数类型，严格）」分流——无构造签名让组件走 Function 路径，
 * props 检查精确为 Props（React 严格语义：未声明 prop 报错）。
 * 子内容类型：JSX children 属性来自全局 IntrinsicAttributes（react-jsx
 * 机制）；组件内读 props.slots（vue 原生，类型由组件 props 声明或 any）。
 */
export type ActViewComponent<
  Props extends Record<string, any> = Record<string, any>,
> = {
  /** 类型层 call signature：TS 走 Function 路径，props = Props */
  (props: Props): VueVNode
  /** ElementAttributesProperty{ $props } 兜底（vue 全局 JSX 机制） */
  $props: Props
  name?: string
  /** vue 组件标记（运行时是 DefineComponent） */
  __isVue?: true
  __vccOpts?: any
}

export interface ActViewDefineComponentOptions {
  name?: string
  /**
   * 运行时 props 声明（@actview/plugin-jsx 编译期从类型注解提取注入，
   * 也可手写）。存在时开启自动落根：未消费的 attrs（class / data-v-* /
   * 事件 / 透传属性）自动 apply 到根元素。
   */
  props?: Record<string, any>
}

export function defineComponent<
  Props extends Record<string, any> = Record<string, any>,
>(
  setup: (props: Props, ctx: SetupContext) => unknown,
  options?: ActViewDefineComponentOptions | string,
): ActViewComponent<Props> {
  const opts: ActViewDefineComponentOptions =
    typeof options === 'string' ? { name: options } : (options ?? {})
  return vueDefineComponent({
    name: opts.name,
    // 编译期提取的 props 声明（无则 undefined——组件保持「任意 props 兜底」）
    props: opts.props as any,
    // 有 props 声明 → 开启自动落根（透传 + scoped data-v 生效）；
    // 无声明 → false（React 语义：避免未消费 props 以 DOM 属性形式污染根元素）
    inheritAttrs: !!opts.props,
    setup(props, ctx) {
      // Vue：未声明 props 的组件所有传入属性进 ctx.attrs（props 对象为空）。
      // 桥接：
      //   - attrs 兜底：读 props 失败时从 attrs 读——React 语义「任意 props 都在 props 上」
      //   - slots 引用暴露：props.slots = ctx.slots（纯引用，不求值；组件内
      //     props.slots.default() 在 render 期调用，依赖追踪正常）
      //   - children（React 对齐）：渲染期读取 = slots.default() 求值（值语义）；
      //     非渲染期读取 = undefined + 一次性提示（不执行——避免「Slot invoked
      //     outside of render function」警告与依赖丢失）；判断有无子内容用
      //     props.slots.default != null（静态检查）
      //   - 虚拟键（children/slots）不参与 ownKeys/descriptor：展开 {...props}、
      //     Object.keys、toRefs 遍历不会带上桥接键（vue 的 slots 机制不走 props）
      const attrs = ctx.attrs as Record<string, any>
      let renderPhase = false
      let warnedNonRenderRead = false

      const bridge = new Proxy(props as object, {
        get(t, k) {
          if (k === 'slots') return ctx.slots
          if (k === 'children') {
            // 渲染期判定：① 本组件 render 区间（词法标记）② 插槽求值区间
            //（模块级深度——组件 JSX children 被插件惰性化为插槽函数，执行
            //  时机在本组件 render 结束之后，见 createVNode 的 wrapSlots）
            if (renderPhase || activeRenderDepth > 0) {
              // React 对齐：单子元素解包为元素本身（vue 插槽规范化返回
              // 数组）；多子元素/空保持数组/null
              const kids = ctx.slots.default?.() ?? null
              if (Array.isArray(kids) && kids.length === 1) return kids[0]
              return kids
            }
            if (!warnedNonRenderRead) {
              warnedNonRenderRead = true
              console.warn(
                '[actview] 非渲染期读取 props.children：插槽内容只在渲染期可用。' +
                  '判断有无子内容请用 props.slots.default != null；' +
                  '渲染期用 props.children 或 props.slots.default()',
              )
            }
            return undefined
          }
          const own = Reflect.get(t, k)
          if (own !== undefined) return own
          return attrs[k as any]
        },
        has(t, k) {
          return (
            k === 'slots' ||
            k === 'children' ||
            Reflect.has(t, k) ||
            k in attrs
          )
        },
        ownKeys(t) {
          // 桥接虚拟键不参与展开/遍历——只有真实 props + attrs
          return [
            ...new Set([
              ...Reflect.ownKeys(t),
              ...Reflect.ownKeys(attrs),
            ]),
          ]
        },
        getOwnPropertyDescriptor(t, k) {
          return (
            Reflect.getOwnPropertyDescriptor(t, k) ??
            Reflect.getOwnPropertyDescriptor(attrs, k)
          )
        },
      })

      const userResult = setup(bridge as Props, ctx)
      // 渲染期标记：桥接包装 render——标记区间 = vue 渲染调用链内
      //（与 vue 的 currentRenderingInstance 上下文同步，slots.default()
      //  此时调用无警告）
      if (typeof userResult === 'function') {
        const userRender = userResult
        return () => {
          renderPhase = true
          try {
            return userRender()
          } finally {
            renderPhase = false
          }
        }
      }
      return userResult
    },
    // 返回类型以声明为准（vue 的推断带 ExtractPropTypes 包装，与泛型 Props 不完全同构）
  }) as unknown as ActViewComponent<Props>
}

// ============================================================
// createContext — React 语义，基于 vue provide/inject
//
//   const ThemeCtx = createContext(defaultTheme)
//   <ThemeCtx.Provider value={state}>...</ThemeCtx.Provider>
//   const state = ThemeCtx.use()   // setup 内调用
//
//   契约（v1 延续，store-as-is）：provide 原样存储——动态值传响应式引用，
//   消费端在 render 里读取自动收集依赖。
// ============================================================

export interface Context<T> {
  /** 内部唯一键（Symbol）：对象身份即键 */
  readonly _key: symbol
  /** vue 组件对象形态的 setup——<Ctx value={v}> 直接作组件用（React 19 风格） */
  setup: (props: any, setupCtx: any) => any
  name?: string
  /** <Ctx.Provider value={v}> 经典风格 */
  Provider: Context<T>
  /** 消费：返回注入表中原样存储的值；无 Provider 时返回 defaultValue */
  use: () => T
  /** 类型层面伪装 call signature，让 <Ctx value=...> 通过 JSX 类型检查 */
  (props: { value?: T; children?: any }): any
}

export function createContext<T extends object>(
  defaultValue: Reactive<T>,
): Context<T>
export function createContext<T>(defaultValue: T): Context<T>
export function createContext(defaultValue: any): Context<any> {
  const key: symbol = Symbol('actview-context')

  const provider = defineComponent(function (
    props: { value?: any; slots?: any },
  ) {
    provide(key, props.value ?? defaultValue)
    return () => h(_Fragment, null, props.slots.default?.() ?? null)
  }, 'ActViewContext.Provider')

  const ctx = {
    _key: key,
    name: 'ActViewContext',
    Provider: provider as any,
    // React 19 风格 <Ctx value={v}>：Context 直接作组件——
    // vue 组件对象 setup 形态（provide + 渲染 children）
    setup(props: any, setupCtx: any) {
      // 无 props 声明的组件：传入属性在 attrs（props.value 兜底 attrs）
      const value = props.value ?? setupCtx.attrs?.value ?? defaultValue
      provide(key, value)
      return () =>
        h(_Fragment, null, setupCtx.slots?.default?.() ?? null)
    },
    use() {
      return inject(key, defaultValue)
    },
  } as Context<any>
  return ctx
}
