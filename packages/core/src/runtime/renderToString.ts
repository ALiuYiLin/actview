import type { VNode, VNodeChild } from '../vnode'
import { getChildren } from '../vnode'
import { setCurrentInstance, getCurrentInstance } from './lifecycle'
import { extractScopedIdProps, SCOPED_ID_PROP } from './scopedProps'
import { HTML_ATTR_OVERRIDES } from './attr-map'

// ============================================================
// renderToString — 构建期/SSR 前置：VNode 树 → HTML 字符串
//   纯函数序列化，无 DOM 依赖，可在 Node 端（构建脚本/SSR）使用
//
// 能力范围（静态生成语义）：
//   - 字符串标签    =》 <div class="..." style="...">children</div>
//   - Fragment      =》 子节点拼接
//   - 文本/数字     =》 HTML 转义
//   - 组件          =》 调用 __setup(props) 拿 render，再 render() 递归
//                      （构建期要求组件无副作用；响应式/事件在静态输出中不生效）
//   - 事件属性 on*  =》 跳过（静态 HTML 无事件）
//   - class/style/value/checked 等 =》 对齐运行时 setProp 语义输出属性
//   - void 元素（input/br/img/hr/meta/link 等）=》 不输出闭合标签
// ============================================================

/** void 元素：HTML 规范中无内容、不闭合 */
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
])

/** SSR 渲染上下文 id 状态：每次 renderToString 调用新建（无模块级共享 →
 *  并发请求安全）。uid 按树遍历序分配（与客户端 mountComponent 遍历序一致，
 *  hydrate 前重置 uid → 两端 useId 相同）；seq 是实例级（ssrInstance.__idSeq）。 */
interface SsrIdState {
  uid: number
}

/** Fragment 标记（与 renderer/jsxFactory 一致：Symbol.for 全局共享） */
const Fragment = Symbol.for('react.fragment')

/** 布尔属性：值为 true 时输出空属性（如 disabled/checked/readonly） */
const BOOLEAN_ATTRS = new Set([
  'disabled',
  'checked',
  'readonly',
  'required',
  'multiple',
  'selected',
  'hidden',
  'autofocus',
  'novalidate',
  'defer',
  'async'
])

/** HTML 文本/属性转义 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** style 对象 → "k:v;k2:v2;" 字符串（camelCase 键原样输出） */
function stringifyStyle(
  style: string | Record<string, string | number>
): string {
  if (typeof style === 'string') return style
  if (!style) return ''
  return Object.entries(style)
    .map(([k, v]) => `${k}:${v}`)
    .join(';')
}

/** 归一化 children：单值 → 数组 */
function toChildrenArray(children: any): any[] {
  if (children == null || typeof children === 'boolean') return []
  return Array.isArray(children) ? children : [children]
}

/** 是否为合法 VNode */
function isVNode(node: any): node is VNode {
  return !!node && typeof node === 'object' && typeof node.$$typeof === 'symbol'
}

/** 递归序列化单个节点；parentInjects 沿树向下传递（子组件共享父注入表引用，对齐运行时） */
function serializeNode(
  node: any,
  parentInjects: Record<PropertyKey, any> | undefined,
  idState: SsrIdState,
): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') {
    return escapeHtml(String(node))
  }
  if (Array.isArray(node)) {
    return node.map((n) => serializeNode(n, parentInjects, idState)).join('')
  }
  if (!isVNode(node)) return ''

  const { type, props } = node

  // Fragment：拼接子节点
  if (type === Fragment) {
    return toChildrenArray(props?.children)
      .map((n) => serializeNode(n, parentInjects, idState))
      .join('')
  }

  // 内置组件（优先于普通组件分支）：
  //   Transition 序列化其 children（SSR 输出渲染结果，客户端水合配对，跳过动画）
  //   Teleport 内联输出 children（SSR 无 DOM 无法解析 target；对齐 React portal /
  //   Vue Teleport——客户端水合时再移动 DOM 到目标容器）
  if ((type as any)?.__builtin === 'transition') {
    return toChildrenArray(getChildren(node))
      .map((n) => serializeNode(n, parentInjects, idState))
      .join('')
  }
  if ((type as any)?.__builtin === 'teleport') {
    return toChildrenArray(getChildren(node))
      .map((n) => serializeNode(n, parentInjects, idState))
      .join('')
  }

  // 组件：__setup(props) 拿 render =》 render() 递归（构建期静态，无响应式上下文）
  //   type 形态：Babel 转换 =》 defineComponent 产物（对象 { __setup }）；
  //   也兼容函数形态（__setup 属性或直接调用）
  const isComponent =
    typeof type === 'function' ||
    (typeof type === 'object' &&
      type != null &&
      typeof (type as any).__setup === 'function')
  if (isComponent) {
    const setup = (type as any).__setup
    // 组件边界 scoped 转换（与运行时 mountComponent 一致）：注入的 data-v-*
    // 合并为 scopedId prop，子组件手动应用后经 serializeAttrs 翻译为真实属性
    const ssrProps = { ...(props ?? {}) }
    extractScopedIdProps(ssrProps)
    // 静态生成上下文：setup 里调用 onMounted 等生命周期钩子时必须有
    // currentInstance（否则警告「只能在组件 setup 中调用」并丢弃）。
    // 用轻量 instance（带钩子空数组即可注册），钩子注册后**不 flush**
    // （SSR/静态生成语义：setup + render，不执行 DOM 钩子，与 Vue SSR 一致）。
    // injects 继承父注入表引用（对齐运行时：子组件共享父表，provide 时 COW），
    // 使 provide/useInjects/createContext 在 SSR 下穿透可用。
    const ssrInstance = {
      id: ++idState.uid,
      props: ssrProps,
      beforeMount: [] as (() => void)[],
      mounted: [] as (() => void)[],
      updated: [] as (() => void)[],
      beforeUnmount: [] as (() => void)[],
      unmounted: [] as (() => void)[],
      activated: [] as (() => void)[],
      deactivated: [] as (() => void)[],
      errorCaptured: [] as ((err: any) => boolean | void)[],
      serverPrefetch: [] as (() => Promise<any> | any)[],
      renderTracked: [] as ((e: any) => void)[],
      renderTriggered: [] as ((e: any) => void)[],
      scope: null,
      parent: null,
      injects: (parentInjects ?? {}) as Record<PropertyKey, any>,
      __idSeq: { value: 0 },
    }
    // 栈式实例窗口：setup 窗口退出还原 prev（不用硬置 null——SSR 序列化嵌套
    // 在组件递归中，父窗口同样需要保全）
    const prevInstance = getCurrentInstance() as any
    setCurrentInstance(ssrInstance as any)
    let render: any
    try {
      // setup(props, ctx)：ctx.injects 指向 ssrInstance 的注入表（继承父表引用）
      const ctx = { injects: ssrInstance.injects }
      render =
        typeof setup === 'function'
          ? setup(ssrProps, ctx)
          : type(ssrProps)
    } finally {
      setCurrentInstance(prevInstance)
    }
    // onServerPrefetch：SSR 阶段同步执行预取钩子（异步 Promise 无法等待，尽力而为）
    for (const hook of ssrInstance.serverPrefetch) hook()
    // render 求值窗口（对齐运行时渲染期实例上下文）：
    // 字面 <slot>/getCurrentInstance 等运行时取例能力在 SSR 下同样成立
    setCurrentInstance(ssrInstance as any)
    try {
      if (typeof render === 'function') {
        return serializeNode(render(), ssrInstance.injects, idState)
      }
      // setup 直接返回 vnode（兼容简写）
      return serializeNode(render, ssrInstance.injects, idState)
    } finally {
      setCurrentInstance(prevInstance)
    }
  }

  // 原生标签
  if (typeof type !== 'string') return ''
  const tag = type as string
  const attrs = serializeAttrs(props)
  const children = toChildrenArray(props?.children)
    .map((n) => serializeNode(n, parentInjects, idState))
    .join('')
  if (VOID_ELEMENTS.has(tag)) return `<${tag}${attrs}>`
  return `<${tag}${attrs}>${children}</${tag}>`
}

/** 属性 → 属性字符串（事件跳过、布尔/空值语义对齐 setProp） */
function serializeAttrs(props: Record<string, any> | null | undefined): string {
  if (!props) return ''
  let out = ''
  for (const key of Object.keys(props)) {
    if (key === 'children' || key === 'key' || key === 'ref') continue
    if (key.startsWith('on')) continue // 事件不输出
    const value = props[key]
    // aria-* / data-*：布尔值字符串化（对齐运行时 setProp：true→"true"、
    // false→"false" 不移除；null/undefined 不输出）
    if (/^(aria|data)-/.test(key)) {
      if (value == null) continue
      out += ` ${key}="${escapeHtml(
        value === true ? 'true' : value === false ? 'false' : String(value),
      )}"`
      continue
    }
    if (value == null || value === false) continue
    // scopedId 约定（@actview/plugin-scoped）：值为 scoped 属性名（可空格分隔
    // 多个），翻译为真实属性输出 —— 与运行时 setProp/patchProps 语义一致
    if (key === SCOPED_ID_PROP) {
      if (typeof value === 'string') {
        for (const attr of value.split(/\s+/).filter(Boolean)) {
          out += ` ${attr}=""`
        }
      }
      continue
    }
    if (key === 'style') {
      const s = stringifyStyle(value)
      if (s) out += ` style="${escapeHtml(s)}"`
      continue
    }
    const name =
      HTML_ATTR_OVERRIDES[key] ??
      (key === 'className'
        ? 'class'
        : key === 'defaultValue'
          ? 'value'
          : key === 'defaultChecked'
            ? 'checked'
            : key)
    if (value === true) {
      // 布尔属性：输出空属性（对齐 setAttribute(key, '')）
      out += ` ${name}${BOOLEAN_ATTRS.has(name) ? '' : '=""'}`
      continue
    }
    out += ` ${name}="${escapeHtml(String(value))}"`
  }
  return out
}

/** VNode 树 → HTML 字符串 */
export function renderToString(vnode: VNode | VNodeChild): string {
  return serializeNode(vnode, undefined, { uid: 0 })
}

// ============================================================
// renderToStringAsync — 异步 SSR：await onServerPrefetch 数据预取
//   async serializeNodeAsync：与同步版同构，仅组件分支 await 预取钩子。
//   lazy 组件仍输出 Suspense fallback（loader 异步加载不阻塞，第一版边界，
//   客户端水合后 resolve 重建真实内容）。
//   id 状态按调用隔离（SsrIdState 参数传递，无模块级共享）→ 并发请求安全。
// ============================================================

/** 递归异步序列化（与 serializeNode 同构；组件分支 await serverPrefetch） */
async function serializeNodeAsync(
  node: any,
  parentInjects: Record<PropertyKey, any> | undefined,
  idState: SsrIdState,
): Promise<string> {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') {
    return escapeHtml(String(node))
  }
  if (Array.isArray(node)) {
    const parts = await Promise.all(
      node.map((n) => serializeNodeAsync(n, parentInjects, idState))
    )
    return parts.join('')
  }
  if (!isVNode(node)) return ''

  const { type, props } = node

  if (type === Fragment) {
    const parts = await Promise.all(
      toChildrenArray(props?.children).map((n) =>
        serializeNodeAsync(n, parentInjects, idState)
      )
    )
    return parts.join('')
  }

  // 内置组件：Transition 序列化 children（与同步版一致）；Teleport 内联输出（水合时移动）
  if ((type as any)?.__builtin === 'transition') {
    const parts = await Promise.all(
      toChildrenArray(getChildren(node)).map((n) =>
        serializeNodeAsync(n, parentInjects, idState)
      )
    )
    return parts.join('')
  }
  if ((type as any)?.__builtin === 'teleport') {
    const parts = await Promise.all(
      toChildrenArray(getChildren(node)).map((n) =>
        serializeNodeAsync(n, parentInjects, idState)
      )
    )
    return parts.join('')
  }

  const isComponent =
    typeof type === 'function' ||
    (typeof type === 'object' &&
      type != null &&
      typeof (type as any).__setup === 'function')
  if (isComponent) {
    const setup = (type as any).__setup
    const ssrProps = { ...(props ?? {}) }
    extractScopedIdProps(ssrProps)
    const ssrInstance = {
      id: ++idState.uid,
      props: ssrProps,
      beforeMount: [] as (() => void)[],
      mounted: [] as (() => void)[],
      updated: [] as (() => void)[],
      beforeUnmount: [] as (() => void)[],
      unmounted: [] as (() => void)[],
      activated: [] as (() => void)[],
      deactivated: [] as (() => void)[],
      errorCaptured: [] as ((err: any) => boolean | void)[],
      serverPrefetch: [] as (() => Promise<any> | any)[],
      renderTracked: [] as ((e: any) => void)[],
      renderTriggered: [] as ((e: any) => void)[],
      scope: null,
      parent: null,
      injects: (parentInjects ?? {}) as Record<PropertyKey, any>,
      __idSeq: { value: 0 },
    }
    // 栈式实例窗口：setup 窗口退出还原 prev（不用硬置 null——SSR 序列化嵌套
    // 在组件递归中，父窗口同样需要保全）
    const prevInstance = getCurrentInstance() as any
    setCurrentInstance(ssrInstance as any)
    let render: any
    try {
      const ctx = { injects: ssrInstance.injects }
      render =
        typeof setup === 'function'
          ? setup(ssrProps, ctx)
          : type(ssrProps)
    } finally {
      setCurrentInstance(prevInstance)
    }
    // 异步数据预取：await 全部 serverPrefetch（同步返回值同样支持）
    await Promise.all(ssrInstance.serverPrefetch.map((hook) => hook()))
    // render 求值窗口（对齐运行时渲染期实例上下文）：
    // 字面 <slot>/getCurrentInstance 等运行时取例能力在 SSR 下同样成立
    setCurrentInstance(ssrInstance as any)
    try {
      if (typeof render === 'function') {
        return serializeNodeAsync(render(), ssrInstance.injects, idState)
      }
      return serializeNodeAsync(render, ssrInstance.injects, idState)
    } finally {
      setCurrentInstance(prevInstance)
    }
  }

  if (typeof type !== 'string') return ''
  const tag = type as string
  const attrs = serializeAttrs(props)
  const children = await Promise.all(
    toChildrenArray(props?.children).map((n) =>
      serializeNodeAsync(n, parentInjects, idState)
    )
  )
  const body = children.join('')
  if (VOID_ELEMENTS.has(tag)) return `<${tag}${attrs}>`
  return `<${tag}${attrs}>${body}</${tag}>`
}

/** VNode 树 → HTML 字符串（异步：await onServerPrefetch 数据预取） */
export async function renderToStringAsync(
  vnode: VNode | VNodeChild
): Promise<string> {
  return serializeNodeAsync(vnode, undefined, { uid: 0 })
}
