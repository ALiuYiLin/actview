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
  createVNode,
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
  Suspense,
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
// defineComponent — slots → props.children 桥接
//
//   Vue 模型：子内容在 ctx.slots（延迟函数）；React 模型：props.children（值）。
//   桥接：Proxy 包住 props——读 props.children 时求值 slots.default()，
//   读 props.slots 时返回整个 slots 表（具名插槽兼容 v1 语义）。
//
//   语义等价 React：children 每次读取重新求值（= 每次 render 重新创建）。
//   ⚠️ setup 只执行一次：不要在 setup 体顶层解构 props.children（快照），
//      在 render 函数里读（响应式 props 是同一对象，闭包捕获安全）。
// ============================================================
import {
  defineComponent as vueDefineComponent,
  Fragment as _Fragment,
  h,
  inject,
  provide,
} from 'vue'

/**
 * v2 组件类型（类型层形状）：
 * 运行时是 vue DefineComponent（createApp/渲染消费），但类型层用自定义形状
 * ——只有 call signature、无构造签名。TS 6 的 JSX 检查（getJsxReferenceKind）
 * 按「构造签名 → Component 路径（$props 宽松）/ 调用签名 → Function 路径
 * （props = 参数类型，严格）」分流——无构造签名让组件走 Function 路径，
 * props 检查精确为 Props & { children }（React 严格语义：未声明 prop 报错）。
 */
export type ActViewComponent<
  Props extends Record<string, any> = Record<string, any>,
> = {
  /** 类型层 call signature：TS 走 Function 路径，props = Props & { children } */
  (props: Props & { children?: any }): VueVNode
  /** ElementAttributesProperty{ $props } 兜底（vue 全局 JSX 机制） */
  $props: Props & { children?: any }
  name?: string
  /** vue 组件标记（运行时是 DefineComponent） */
  __isVue?: true
  __vccOpts?: any
}

export function defineComponent<
  Props extends Record<string, any> = Record<string, any>,
>(
  setup: (props: Props, ctx: SetupContext) => unknown,
  name?: string,
): ActViewComponent<Props> {
  return vueDefineComponent({
    name,
    // 未消费 props 不自动落根 DOM（React 语义；Vue 默认 inheritAttrs 会落）
    inheritAttrs: false,
    setup(props, ctx) {
      // Vue：未声明 props 的组件所有传入属性进 ctx.attrs（props 对象为空）。
      // 桥接：读 props 失败时从 attrs 兜底——React 语义「任意 props 都在 props 上」
      const attrs = ctx.attrs as Record<string, any>
      const bridge = new Proxy(props as object, {
        get(t, k) {
          if (k === 'children') return ctx.slots.default?.() ?? null
          if (k === 'slots') return ctx.slots
          const own = Reflect.get(t, k)
          if (own !== undefined) return own
          return attrs[k as any]
        },
        has(t, k) {
          return (
            k === 'children' ||
            k === 'slots' ||
            Reflect.has(t, k) ||
            k in attrs
          )
        },
        ownKeys(t) {
          return [
            ...new Set([
              ...Reflect.ownKeys(t),
              ...Reflect.ownKeys(attrs),
              'children',
              'slots',
            ]),
          ]
        },
        getOwnPropertyDescriptor(t, k) {
          if (k === 'children' || k === 'slots') {
            return {
              enumerable: true,
              configurable: true,
              value:
                k === 'children' ? (ctx.slots.default?.() ?? null) : ctx.slots,
            }
          }
          return (
            Reflect.getOwnPropertyDescriptor(t, k) ??
            Reflect.getOwnPropertyDescriptor(attrs, k)
          )
        },
      })
      return setup(bridge as Props, ctx)
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
  /** <Ctx value={v}> 直接作组件用（React 19 风格） */
  __setup: (props: any, ctx: any) => any
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
    props: { value?: any; children?: any },
  ) {
    provide(key, props.value ?? defaultValue)
    return () => h(_Fragment, null, props.children ?? null)
  }, 'ActViewContext.Provider')

  const ctx = {
    _key: key,
    __setup: (provider as any).__setup,
    name: 'ActViewContext',
    Provider: provider as any,
    use() {
      return inject(key, defaultValue)
    },
  } as Context<any>
  return ctx
}
