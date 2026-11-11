// ============================================================
// 组件实例 / setup / props / render 根节点（M1）
//
// 组件 = 带 `__actview_component` 标记的 setup 函数（见 runtime-core），
// setup 只执行一次，返回 render 函数；render 每次更新执行，返回值经
// renderComponentRoot 归一化为 VNode 树交给渲染器。
//
// 依赖边界（docs/renderer-design.md §9）：
//   - setup 在父组件 render effect 执行栈中运行，必须 pauseTracking，
//     否则 setup 内的响应式读取会被父 effect 收集；
//   - render 执行期间正常 tracking：组件依赖的唯一来源；
//   - props 是 shallowReactive 且原地写：父更新 → 子 render effect 重跑。
// ============================================================

import {
  EffectScope,
  pauseTracking,
  resetTracking,
  shallowReactive,
} from '@actview/reactivity'
import type { RenderFunction, SetupContext } from '@actview/runtime-core'
import {
  Fragment,
  createTextVNode,
  createVNode,
  isVNode,
  type VNode,
} from '@actview/runtime-core/internal'
import { hasChanged, hasOwn } from '@actview/shared'
import type { AppContext, ComponentInternalInstance } from './instance'
import { setCurrentInstance } from './lifecycle'

/** 组件 uid 自增计数器（job.id 排序 / 去重用） */
let uid = 0

/**
 * 创建组件实例（挂载第一帧，渲染器调用）。
 *
 * - scope 是 detached：不继承父 scope，组件卸载时自行 stop；
 * - effect / job / update 由渲染器在 setupRenderEffect 中填充，这里占位；
 * - injects 继承父实例的注入表（M2 provide/inject 的 copy-on-write 基础）。
 */
export function createComponentInstance(
  vnode: VNode,
  parent: ComponentInternalInstance | null,
  appContext: AppContext,
): ComponentInternalInstance {
  const instance: ComponentInternalInstance = {
    uid: uid++,
    type: vnode.type as ComponentInternalInstance['type'],
    parent,
    appContext,
    vnode,
    // 占位：真正 props 在 setupComponent → initProps 中创建
    props: {},
    // setup 执行后才有 render（setupComponent 写入）
    render: null as unknown as RenderFunction,
    subTree: null,
    // renderer 填（setupRenderEffect）
    effect: null as unknown as ComponentInternalInstance['effect'],
    job: null as unknown as ComponentInternalInstance['job'],
    scope: new EffectScope(true),
    isMounted: false,
    container: null,
    injects: parent ? parent.injects : {},
    update: () => {},
    beforeMount: [],
    mounted: [],
    beforeUpdate: [],
    updated: [],
    beforeUnmount: [],
    unmounted: [],
    errorCaptured: [],
  }

  // vnode 与实例互相指向：更新时 updateComponent 通过 n1.component 复用实例
  vnode.component = instance

  return instance
}

/**
 * 初始化组件实例：执行一次 setup，把返回的 render 函数挂到实例上。
 *
 * 注意 pauseTracking：setup 在父组件 render effect 栈内执行，其中的
 * 响应式读取不能污染父 effect（§9）。
 */
export function setupComponent(instance: ComponentInternalInstance): void {
  initProps(instance, instance.vnode.props ?? null)

  const prev = setCurrentInstance(instance)
  try {
    instance.scope.run(() => {
      pauseTracking()
      try {
        // 运行时取 setup：类型层是 ComponentTag（公开的 JSX 标签视图），
        // 实际调用形状是 setup(props, ctx) => render。
        const setup = instance.type as unknown as (
          props: Record<string, any>,
          ctx: SetupContext,
        ) => unknown
        const result = setup(instance.props, {
          get injects() {
            return instance.injects
          },
        })

        // async setup 属 M3（Suspense）；M1 明确报错，避免静默拿到 Promise
        if (isThenable(result)) {
          throw new Error(
            `[actview] 组件 "${getComponentName(instance)}" 的 setup 返回了 Promise：` +
              `M1 仅支持同步 setup（async setup / Suspense 在 M3 提供）`,
          )
        }
        if (typeof result !== 'function') {
          throw new Error(
            `[actview] 组件 "${getComponentName(instance)}" 的 setup 必须返回 render 函数` +
              `（当前为 ${typeof result}）`,
          )
        }

        instance.render = result as unknown as RenderFunction
      } finally {
        resetTracking()
      }
    })
  } finally {
    setCurrentInstance(prev)
  }
}

/** props 初始化：拷贝 vnode.props 为 shallowReactive（key 属于 VNode 身份，不进 props） */
export function initProps(
  instance: ComponentInternalInstance,
  props: Record<string, any> | null,
): void {
  const raw: Record<string, any> = props ? { ...props } : {}
  delete raw.key
  instance.props = shallowReactive(raw)
}

/**
 * 父组件更新时原地写 props（不换对象，避免子 render effect 的依赖失效）。
 *
 * - next 中新增 / 变更的 key：值变化（hasChanged）才写入；
 * - next 中不存在的旧 key：删除；
 * - 写入 shallowReactive 会触发子组件 render effect 的 scheduler → queueJob。
 */
export function updateProps(
  instance: ComponentInternalInstance,
  nextProps: Record<string, any> | null,
  prevProps: Record<string, any> | null,
): void {
  const props = instance.props as Record<string, any>
  const next = nextProps ?? {}
  const prev = prevProps ?? {}
  if (next === prev) return

  for (const key of Object.keys(next)) {
    if (key === 'key') continue
    if (hasChanged(next[key], props[key])) {
      props[key] = next[key]
    }
  }

  for (const key of Object.keys(prev)) {
    if (key === 'key') continue
    if (!hasOwn(next, key)) {
      delete props[key]
    }
  }
}

/**
 * 执行组件 render 并归一化返回值（§6.3）：
 *
 *   null / undefined / boolean → null
 *   string / number            → 文本 VNode
 *   array                      → Fragment VNode（children = 数组）
 *   VNode                      → 原样
 *   其它（函数 / 对象等）       → 报错（带组件名）
 */
export function renderComponentRoot(
  instance: ComponentInternalInstance,
): VNode | null {
  // 组件契约：render 是 setup 返回的函数；此处只关心运行时返回值形状
  const render = instance.render as unknown as () => unknown
  const result = render()

  if (result === null || result === undefined || typeof result === 'boolean') {
    return null
  }
  if (typeof result === 'string' || typeof result === 'number') {
    return createTextVNode(String(result))
  }
  if (Array.isArray(result)) {
    return createVNode(Fragment, { children: result })
  }
  if (isVNode(result)) {
    return result
  }

  throw new Error(
    `[actview] 组件 "${getComponentName(instance)}" 的 render 返回值非法：` +
      `期望 VNode / 数组 / string / number / null，当前为 ${describeValue(result)}`,
  )
}

/**
 * 是否需要更新子组件（M1：props 浅比较）。
 *
 * key 集合不同，或同名 key 的值 hasChanged → true；否则 false。
 * 显式 queueJob 与 props 写入触发的 scheduler 由 job 去重合并。
 */
export function shouldUpdateComponent(n1: VNode, n2: VNode): boolean {
  const prevProps = n1.props ?? {}
  const nextProps = n2.props ?? {}
  if (prevProps === nextProps) return false

  const prevKeys = Object.keys(prevProps)
  const nextKeys = Object.keys(nextProps)
  if (prevKeys.length !== nextKeys.length) return true

  for (const key of nextKeys) {
    if (!hasOwn(prevProps, key) || hasChanged(nextProps[key], prevProps[key])) {
      return true
    }
  }

  return false
}

/** 组件名（错误信息 / DevTools 用） */
function getComponentName(instance: ComponentInternalInstance): string {
  const name = instance.type.name
  return typeof name === 'string' && name.length > 0 ? name : 'Anonymous'
}

/** isThenable：识别 setup 返回 Promise 的情况（async setup） */
function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

/** 非法 render 值的可读描述（错误信息用） */
function describeValue(value: unknown): string {
  if (typeof value === 'function') return 'function'
  if (Array.isArray(value)) return 'array'
  return typeof value === 'object' ? 'object' : typeof value
}
