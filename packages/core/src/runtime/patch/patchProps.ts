// ============================================================
// DOM props patch + 元素工厂 — 属性 / class / style / 事件 / SVG
// （docs/renderer.md）
//
//   createElement：SVG 标签走 createElementNS，其余 createElement。
//
//   patchProp 处理顺序（prev===next 一律跳过）：
//   - 跳过 children / key / ref（children 由 renderer 的 children diff 处理）
//   - onXxx（第三字符大写）→ 事件；支持 Capture / Once / Passive 后缀与
//     { handler, capture?, once?, passive? } 对象形态
//   - class：string / array / object 归一化后 setAttribute；空值移除
//   - style：string → cssText；对象 → 逐项写（kebab/--var 走 setProperty），
//     移除旧对象中消失或为 null 的 key；null/'' 清空
//   - innerHTML / textContent 特殊 key
//   - value：写 DOM property（null/undefined → ''）
//   - 布尔属性：true → 属性 +（可写的）DOM property；false/null → 复位并移除
//   - 其它：shouldSetAsProp → 写 DOM property，否则 setAttribute
// ============================================================

/** SVG 命名空间 */
const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * SVG 标签集合（参考旧实现 renderer.ts 的 SVG_TAGS）：
 * 这些标签必须用 createElementNS 创建，否则渲染成未知 HTML 元素。
 */
const SVG_TAGS = new Set(
  (
    'svg,animate,animateMotion,animateTransform,circle,clipPath,defs,desc,' +
    'ellipse,feBlend,feColorMatrix,feComponentTransfer,feComposite,feConvolveMatrix,' +
    'feDiffuseLighting,feDisplacementMap,feDistantLight,feDropShadow,feFlood,feFuncA,' +
    'feFuncB,feFuncG,feFuncR,feGaussianBlur,feImage,feMerge,feMergeNode,feMorphology,' +
    'feOffset,fePointLight,feSpecularLighting,feSpotLight,feTile,feTurbulence,filter,' +
    'foreignObject,g,image,line,linearGradient,marker,mask,metadata,mpath,path,pattern,' +
    'polygon,polyline,radialGradient,rect,set,stop,symbol,switch,text,textPath,tspan,' +
    'use,view'
  ).split(','),
)

/** 按标签创建元素：SVG 元素走 createElementNS，其余 createElement */
export function createElement(tag: string): Element {
  return SVG_TAGS.has(tag)
    ? document.createElementNS(SVG_NS, tag)
    : document.createElement(tag)
}

/** 不参与 DOM patch 的 props key（由别处处理） */
const SKIP_KEYS = new Set(['children', 'key', 'ref'])

/**
 * 需要按“枚举字符串属性”而非布尔属性处理的 key：
 * true → "true"、false → "false"（而不是空字符串属性）。
 */
const STRING_ATTRIBUTE_KEYS = new Set(['spellcheck', 'draggable', 'translate'])

/** onXxx：'on' + 大写字母（第三字符），避免把 once / only 之类误判为事件 */
function isEventKey(key: string): boolean {
  return /^on[A-Z]/.test(key)
}

/** scoped CSS 标记 prop：值是一个或多个属性名（空格分隔） */
const SCOPED_ID_KEYS = new Set(['scopedId', 'scopeId'])

function normalizeScopedIds(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.split(/\s+/).filter(Boolean)
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeScopedIds(item))
  }
  return []
}

/**
 * scopedId / scopeId 不是普通 DOM 属性：
 *   scopedId="data-v-abc" → <div data-v-abc>
 * 更新时移除旧标记，避免 data-v-old 残留。
 */
function patchScopedIds(el: Element, prev: unknown, next: unknown): void {
  const prevIds = normalizeScopedIds(prev)
  const nextIds = normalizeScopedIds(next)
  for (const id of prevIds) {
    if (!nextIds.includes(id)) el.removeAttribute(id)
  }
  for (const id of nextIds) {
    el.setAttribute(id, '')
  }
}

interface ParsedEventKey {
  eventName: string
  capture: boolean
  once: boolean
  passive: boolean
}

/**
 * 解析事件 prop 名：onClick → click；onClickCapture → click + capture；
 * onScrollPassive → scroll + passive；后缀可组合（onClickCapturePassive）。
 */
function parseEventKey(key: string): ParsedEventKey | null {
  let name = key.slice(2)
  let capture = false
  let once = false
  let passive = false

  for (;;) {
    if (name.endsWith('Capture')) {
      capture = true
      name = name.slice(0, -'Capture'.length)
      continue
    }
    if (name.endsWith('Once')) {
      once = true
      name = name.slice(0, -'Once'.length)
      continue
    }
    if (name.endsWith('Passive')) {
      passive = true
      name = name.slice(0, -'Passive'.length)
      continue
    }
    break
  }

  if (!name) return null
  // DOM 标准事件名均为小写（onMouseDown → mousedown）
  return { eventName: name.toLowerCase(), capture, once, passive }
}

/** 事件 handler 对象形态：{ handler, capture?, once?, passive? } */
interface EventHandlerObject {
  handler?: unknown
  capture?: boolean
  once?: boolean
  passive?: boolean
}

/** 归一化事件值：函数 / handler 对象 → 实际监听函数；其它 → null */
function normalizeEventHandler(
  value: unknown,
): { fn: EventListener; options: EventHandlerObject } | null {
  if (typeof value === 'function') {
    return { fn: value as EventListener, options: {} }
  }
  if (value && typeof value === 'object') {
    const obj = value as EventHandlerObject
    if (typeof obj.handler === 'function') {
      return { fn: obj.handler as EventListener, options: obj }
    }
  }
  return null
}

/** 事件 handler 归一化为数组（支持 attrs 合并产生的 handler 数组） */
function normalizeEventHandlers(
  value: unknown,
): Array<{ fn: EventListener; options: EventHandlerObject }> {
  if (Array.isArray(value)) {
    const out: Array<{ fn: EventListener; options: EventHandlerObject }> = []
    for (const item of value) out.push(...normalizeEventHandlers(item))
    return out
  }
  const one = normalizeEventHandler(value)
  return one ? [one] : []
}

/** 事件：先按旧 handler 的 capture 解绑，再按新 options 绑定 */
function patchEvent(
  el: Element,
  key: string,
  prev: unknown,
  next: unknown,
): void {
  const parsed = parseEventKey(key)
  if (!parsed) return

  for (const prevHandler of normalizeEventHandlers(prev)) {
    // removeEventListener 只匹配 capture（once / passive 不参与匹配）
    el.removeEventListener(
      parsed.eventName,
      prevHandler.fn,
      parsed.capture || !!prevHandler.options.capture,
    )
  }

  for (const nextHandler of normalizeEventHandlers(next)) {
    el.addEventListener(parsed.eventName, nextHandler.fn, {
      capture: parsed.capture || !!nextHandler.options.capture,
      once: parsed.once || !!nextHandler.options.once,
      passive: parsed.passive || !!nextHandler.options.passive,
    })
  }
}

/**
 * class 归一化：string 原样；array 扁平化 + 过滤 falsy 后 join ' '；
 * object 取值为 truthy 的 key join ' '。
 */
function normalizeClass(value: unknown): string {
  if (value == null || value === true || value === false) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)

  if (Array.isArray(value)) {
    let out = ''
    for (const item of value) {
      if (!item) continue
      const cls = normalizeClass(item)
      if (cls) out = out ? `${out} ${cls}` : cls
    }
    return out
  }

  if (typeof value === 'object') {
    let out = ''
    for (const key in value as Record<string, unknown>) {
      if ((value as Record<string, unknown>)[key]) {
        out = out ? `${out} ${key}` : key
      }
    }
    return out
  }

  return ''
}

/** class：归一化后写 attribute（SVG / HTML 一致），空值移除 */
function patchClass(el: Element, next: unknown): void {
  const cls = normalizeClass(next)
  if (!cls) {
    el.removeAttribute('class')
  } else {
    el.setAttribute('class', cls)
  }
}

/** 归一化 style：支持 string / object / 数组（attrs 合并会产生数组） */
function normalizeStyleValue(value: unknown): {
  cssText: string
  decls: Record<string, unknown>
} {
  const result: { cssText: string; decls: Record<string, unknown> } = {
    cssText: '',
    decls: {},
  }

  const visit = (item: unknown): void => {
    if (item == null || item === '') return
    if (typeof item === 'string') {
      result.cssText = result.cssText ? `${result.cssText};${item}` : item
      return
    }
    if (Array.isArray(item)) {
      for (const child of item) visit(child)
      return
    }
    if (typeof item === 'object') {
      Object.assign(result.decls, item as Record<string, unknown>)
    }
  }

  visit(value)
  return result
}

/** style：字符串写 cssText；对象逐项写并清理旧对象里多余/为 null 的 key */
function patchStyle(el: Element, prev: unknown, next: unknown): void {
  const style = (el as HTMLElement).style
  if (!style) return

  const prevStyle = normalizeStyleValue(prev)
  const nextStyle = normalizeStyleValue(next)
  const hasNext =
    nextStyle.cssText !== '' || Object.keys(nextStyle.decls).length > 0

  if (!hasNext) {
    style.cssText = ''
    return
  }

  if (nextStyle.cssText) {
    style.cssText = nextStyle.cssText
  } else if (prevStyle.cssText) {
    // 旧值是字符串、新值是对象：先清空，避免旧 cssText 残留叠加
    style.cssText = ''
  }

  if (!nextStyle.cssText) {
    for (const key of Object.keys(prevStyle.decls)) {
      if (!(key in nextStyle.decls) || nextStyle.decls[key] == null) {
        removeStyle(style, key)
      }
    }
  }
  for (const key of Object.keys(nextStyle.decls)) {
    setStyle(style, key, nextStyle.decls[key])
  }
}

/** 写单个 style 值：kebab-case / --var 走 setProperty，其余写 property */
function setStyle(style: CSSStyleDeclaration, key: string, value: unknown): void {
  if (value == null || value === '') {
    removeStyle(style, key)
    return
  }
  // 数值转字符串（不做自动 px，交给调用方决定单位）
  const str = String(value)
  if (key.startsWith('--') || key.includes('-')) {
    style.setProperty(key, str)
  } else {
    ;(style as any)[key] = str
  }
}

/** 移除单个 style 值 */
function removeStyle(style: CSSStyleDeclaration, key: string): void {
  if (key.startsWith('--') || key.includes('-')) {
    style.removeProperty(key)
  } else {
    ;(style as any)[key] = ''
  }
}

/**
 * 是否应写 DOM property（而非 setAttribute）。
 * - SVG：多数同名 key 是只读 SVGAnimated*（className/cx/cy 等），写 property
 *   在严格模式下会抛 TypeError → 一律走 attribute；
 * - form / list / type：DOM property 为只读引用或语义不同 → 走 attribute；
 * - 其余：key 在 el 上即写 property（value / checked / disabled 等）。
 */
function shouldSetAsProp(el: Element, key: string): boolean {
  if (!(key in el)) return false
  if (el.namespaceURI === SVG_NS) return false
  if (key === 'form' || key === 'list') return false
  if (key === 'type') return false
  return true
}

/** 该 key 在当前元素上是否为可写布尔 property（checked/disabled/muted 等） */
function isBooleanProp(el: Element, key: string): boolean {
  return shouldSetAsProp(el, key) && typeof (el as any)[key] === 'boolean'
}

/** value：写 DOM property；null/undefined → ''（property 与 attribute 一起清理） */
function patchValueProp(el: Element, next: unknown): void {
  if (next == null) {
    if ('value' in el) {
      ;(el as any).value = ''
    }
    el.removeAttribute('value')
    return
  }
  const str = String(next)
  if ('value' in el) {
    ;(el as any).value = str
  } else {
    el.setAttribute('value', str)
  }
}

/**
 * 写入单个 prop（prev === next 时跳过）。
 */
export function patchProp(
  el: Element,
  key: string,
  prev: unknown,
  next: unknown,
): void {
  if (SKIP_KEYS.has(key)) return
  if (prev === next) return

  if (SCOPED_ID_KEYS.has(key)) {
    patchScopedIds(el, prev, next)
    return
  }

  if (isEventKey(key)) {
    patchEvent(el, key, prev, next)
    return
  }

  if (key === 'class') {
    patchClass(el, next)
    return
  }

  if (key === 'style') {
    patchStyle(el, prev, next)
    return
  }

  // 特殊 key：直接写 DOM 内容（null → 清空）
  if (key === 'innerHTML') {
    ;(el as HTMLElement).innerHTML = next == null ? '' : String(next)
    return
  }
  if (key === 'textContent') {
    el.textContent = next == null ? '' : String(next)
    return
  }

  // 枚举字符串属性（draggable="true" 等，不能按布尔属性写空字符串）
  if (STRING_ATTRIBUTE_KEYS.has(key)) {
    if (next == null) {
      el.removeAttribute(key)
    } else {
      el.setAttribute(key, String(next))
    }
    return
  }

  // value：写 DOM property（select/option/input/textarea 通用）
  if (key === 'value') {
    patchValueProp(el, next)
    return
  }

  // 布尔属性：true → 属性存在 +（可写时）property 置 true
  if (next === true) {
    if (isBooleanProp(el, key)) {
      ;(el as any)[key] = true
    }
    el.setAttribute(key, '')
    return
  }
  // false / null / undefined → property 复位（checked/disabled 等）并移除属性
  if (next === false || next == null) {
    if (isBooleanProp(el, key)) {
      ;(el as any)[key] = false
    }
    el.removeAttribute(key)
    return
  }

  // DOM property（value / checked / disabled 等已在上面处理）
  if (shouldSetAsProp(el, key)) {
    ;(el as any)[key] = next
    return
  }

  el.setAttribute(key, String(next))
}

/**
 * 批量 patch：先写 next 的 key（含新增/更新），再清理 prev 里已不存在的 key
 * （属性移除 / 事件解绑 / DOM property 复位）。
 */
export function patchProps(
  el: Element,
  prevProps: Record<string, any> | null,
  nextProps: Record<string, any> | null,
): void {
  const prev = prevProps || {}
  const next = nextProps || {}

  for (const key in next) {
    patchProp(el, key, prev[key], next[key])
  }

  for (const key in prev) {
    if (!(key in next)) {
      patchProp(el, key, prev[key], null)
    }
  }
}
