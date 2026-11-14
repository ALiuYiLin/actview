// ============================================================
// 组件实例 / setup / props / render 根节点（M1 起，M3 补 async setup）
//
// 组件 = @Component 类（见 decorator/component）；setup 由 mountComponent 编排。
// setup 只执行一次，返回 render 函数；render 每次更新执行，返回值经
// renderComponentRoot 归一化为 VNode 树交给渲染器。
// M3：setup 可以返回 Promise（async setup）——先挂 `() => null` 占位，
// 返回 Promise<RenderFunction> 给渲染器集成 Suspense / 错误处理。
//
// 依赖边界（docs/renderer.md）：
//   - setup 在父组件 render effect 执行栈中运行，必须 pauseTracking，
//     否则 setup 内的响应式读取会被父 effect 收集；
//   - render 执行期间正常 tracking：组件依赖的唯一来源；
//   - props 是 shallowReactive 且原地写：父更新 → 子 render effect 重跑。
//
// M2：createComponentInstance 同时创建公开实例 proxy（组件 ref /
// app.mount 返回值），并提供 provide/inject 所需的 injects 继承表。
// ============================================================

import { EffectScope, shallowReactive } from '@actview/reactivity'
import type { RenderFunction } from '../internal'
import {
  Fragment,
  Text,
  createTextVNode,
  createVNode,
  isComponent,
  isVNode,
  type VNode,
} from '../internal'
import { hasChanged, hasOwn } from '@actview/shared'
import { getComponentMeta } from '../decorator'
import { nextTick } from './scheduler'
import { mountClassComponent } from './mountComponent'
import type {
  AppContext,
  ComponentInternalInstance,
  ComponentPublicInstance,
} from './instance'

/** 组件 uid 自增计数器（job.id 排序 / 去重用） */
let uid = 0

/**
 * 创建组件实例（挂载第一帧，渲染器调用）。
 *
 * - scope 是 detached：不继承父 scope，组件卸载时自行 stop；
 * - effect / job / update 由渲染器在 setupRenderEffect 中填充，这里占位；
 * - injects 继承父实例的注入表（M2 provide/inject 的 copy-on-write 基础）；
 * - proxy（公开实例）在这里创建，保证 setupComponent 之前就位。
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
    attrs: {},
    inheritAttrs: true,
    // setup 执行后才有 render（setupComponent 写入）
    render: null as unknown as RenderFunction,
    subTree: null,
    // renderer 填（setupRenderEffect）
    effect: null as unknown as ComponentInternalInstance['effect'],
    job: null as unknown as ComponentInternalInstance['job'],
    scope: new EffectScope(true),
    renderCount: 0,
    isMounted: false,
    container: null,
    // 注入表继承：子组件共享父实例的引用（零拷贝），首次 provide 时
    // 由 apiProvide 做 copy-on-write；根组件继承 app.provide 的根注入表。
    injects: parent ? parent.injects : appContext.provides,
    // 先占位，下面用 createComponentPublicInstance 创建（需要 instance 本身）
    proxy: null as unknown as ComponentPublicInstance,
    update: () => {},
    beforeMount: [],
    mounted: [],
    beforeUpdate: [],
    updated: [],
    beforeUnmount: [],
    unmounted: [],
    activated: [],
    deactivated: [],
    errorCaptured: [],
  }

  // vnode 与实例互相指向：更新时 updateComponent 通过 n1.component 复用实例
  vnode.component = instance

  // 公开实例 proxy 必须在 setupComponent 之前就位：setup 期间用户就可能
  // 通过 getCurrentInstance()!.proxy 或 ctx 拿到它，渲染器也会在 setup 后
  // 用 instance.proxy 写组件 ref（子组件继承 parent.proxy 时父 proxy 已存在）。
  instance.proxy = createComponentPublicInstance(instance)

  return instance
}

/**
 * 创建组件公开实例（public instance proxy）。
 *
 * 这是 `app.mount()` 返回值 / 组件 ref 暴露给用户的对象：只包含公开字段，
 * 内部实例通过 `$` 逃生口访问。
 *
 * 全部字段用 getter 读取实例状态（而不是快照值）：
 * - `$props` 必须是 getter：`initProps` 会把 `instance.props` 从占位 `{}`
 *   整体替换为 shallowReactive 对象，快照引用会失效；props 本身原地更新，
 *   因此每次读 getter 拿到的都是当前对象；
 * - `$el` 首帧渲染完成后才有值（挂载前 / render 返回 null 时为 null）；
 * - `$parent` / `$root` 走 parent 链的 proxy（根组件 `$root` 指向自身）。
 */
export function createComponentPublicInstance(
  instance: ComponentInternalInstance,
): ComponentPublicInstance {
  return {
    // 内部实例逃生口（调试 / 进阶用法）
    $: instance,
    get $props(): Record<string, any> {
      return instance.props
    },
    get $attrs(): Record<string, any> {
      return instance.attrs
    },
    get $el(): Element | null {
      return (instance.vnode.el as Element | null) ?? null
    },
    get $parent(): ComponentPublicInstance | null {
      return instance.parent?.proxy ?? null
    },
    get $root(): ComponentPublicInstance {
      let root = instance
      while (root.parent) root = root.parent
      return root.proxy
    },
    // 强制更新：直接入队组件 job，跳过 shouldUpdateComponent 的 props 比较
    $forceUpdate: () => instance.update(),
    $nextTick: nextTick,
  }
}

/**
 * 初始化组件实例：第一版只有 @Component 类组件路径。
 * @Ref / @Prop accessor 在构造后立即安装，然后执行 @Setup。
 */
export function setupComponent(
  instance: ComponentInternalInstance,
): Promise<RenderFunction> | null {
  initProps(instance, instance.vnode.props ?? null)
  return mountClassComponent(instance)
}

/** props 初始化：拷贝 vnode.props 为 shallowReactive（key 属于 VNode 身份，不进 props） */
export function initProps(
  instance: ComponentInternalInstance,
  props: Record<string, any> | null,
): void {
  const raw: Record<string, any> = props ? { ...props } : {}
  delete raw.key
  instance.inheritAttrs =
    getComponentMeta(instance.type).inheritAttrs !== false
  instance.props = shallowReactive(raw)
  instance.attrs = shallowReactive(collectAttrs(instance, raw))
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

  syncAttrs(instance, collectAttrs(instance, next))
}

/** 收集未声明 props 的 attrs；children/key/ref 不参与 DOM 透传 */
function collectAttrs(
  instance: ComponentInternalInstance,
  raw: Record<string, any>,
): Record<string, any> {
  const declared = getComponentMeta(instance.type).props
  const attrs: Record<string, any> = {}
  for (const key of Object.keys(raw)) {
    if (key === 'key' || key === 'ref' || key === 'children') continue
    if (declared.has(key)) continue
    attrs[key] = raw[key]
  }
  return attrs
}

/** 原地同步 attrs（保持浅响应式对象的引用稳定） */
function syncAttrs(
  instance: ComponentInternalInstance,
  next: Record<string, any>,
): void {
  const attrs = instance.attrs
  for (const key of Object.keys(attrs)) {
    if (!hasOwn(next, key)) delete attrs[key]
  }
  for (const key of Object.keys(next)) {
    if (hasChanged(next[key], attrs[key])) {
      attrs[key] = next[key]
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

  let root: VNode | null
  if (result === null || result === undefined || typeof result === 'boolean') {
    root = null
  } else if (typeof result === 'string' || typeof result === 'number') {
    root = createTextVNode(String(result))
  } else if (Array.isArray(result)) {
    root = createVNode(Fragment, { children: result })
  } else if (isVNode(result)) {
    root = result
  } else {
    throw new Error(
      `[actview] 组件 "${getComponentName(instance)}" 的 render 返回值非法：` +
        `期望 VNode / 数组 / string / number / null，当前为 ${describeValue(result)}`,
    )
  }

  return applyAttrs(instance, root)
}

/** attrs 自动落到单根元素 / 单根组件；Fragment/Text/builtin/null 不自动继承 */
function applyAttrs(
  instance: ComponentInternalInstance,
  root: VNode | null,
): VNode | null {
  const keys = Object.keys(instance.attrs)
  if (!instance.inheritAttrs || keys.length === 0) return root

  if (root && canInheritAttrs(root)) {
    return {
      ...root,
      props: mergeProps(root.props ?? {}, instance.attrs),
    }
  }

  if (__DEV__) {
    const kind =
      root == null
        ? 'null'
        : root.type === Fragment
          ? 'Fragment'
          : root.type === Text
            ? 'Text'
            : 'Teleport/Transition 等非元素根节点'
    console.warn(
      `[actview] 组件 "${getComponentName(instance)}" 的 attrs (${keys.join(
        ', ',
      )}) 无法自动继承：根节点是 ${kind}。` +
        '可使用 inheritAttrs: false + $attrs 手动处理。',
    )
  }
  return root
}

function canInheritAttrs(vnode: VNode): boolean {
  return typeof vnode.type === 'string' || isComponent(vnode.type)
}

/** 合并根节点 props 与 attrs；class/style 合并，onXxx 变为数组，其余 attrs 覆盖 */
function mergeProps(
  base: Record<string, any>,
  attrs: Record<string, any>,
): Record<string, any> {
  const out: Record<string, any> = { ...base }
  for (const key of Object.keys(attrs)) {
    const incoming = attrs[key]
    if (key === 'class') {
      out.class = out.class == null ? incoming : [out.class, incoming]
    } else if (key === 'style') {
      out.style = out.style == null ? incoming : [out.style, incoming]
    } else if (/^on[A-Z]/.test(key)) {
      out[key] = out[key] == null ? incoming : [out[key], incoming]
    } else {
      out[key] = incoming
    }
  }
  return out
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
