// ============================================================
// attr-utils.ts — 属性/样式规范化共享工具（客户端 setProp 与 SSR
// serializeAttrs/stringifyStyle 双端复用）
//
// 背景：C7/C2/C11 等「SSR 与客户端输出不一致」缺陷的结构性根因是
// 两端各写一套规则。React/Vue 均让双端走同一套规范化（React
// setValueForStyles 双端调用；Vue patchStyle/SSR 同源）。本模块就是
// ActView 的共享规范层：布尔属性、enumerated 属性、class 合并、
// style 值（undefined 过滤 + 数字补 px）、React 分组属性决策
// （resolveAttr：URL 清洗 / xlink-xml 命名空间 / 数值校验）统一由这里产出。
// ============================================================

import { HTML_ATTR_OVERRIDES } from './attr-map'

/** CSS 属性中「接受数字但无 px 单位」的白名单（照抄 React
 *  react-dom-bindings/src/shared/isUnitlessNumber.js）——
 *  lineHeight/opacity/flex/order/zIndex 等补 px 会产出非法值。 */
const UNITLESS = new Set([
  'animationIterationCount',
  'aspectRatio',
  'borderImageOutset',
  'borderImageSlice',
  'borderImageWidth',
  'boxFlex',
  'boxFlexGroup',
  'boxOrdinalGroup',
  'columnCount',
  'columns',
  'flex',
  'flexGrow',
  'flexPositive',
  'flexShrink',
  'flexNegative',
  'flexOrder',
  'gridArea',
  'gridRow',
  'gridRowEnd',
  'gridRowSpan',
  'gridRowStart',
  'gridColumn',
  'gridColumnEnd',
  'gridColumnSpan',
  'gridColumnStart',
  'fontWeight',
  'lineClamp',
  'lineHeight',
  'opacity',
  'order',
  'orphans',
  'scale',
  'tabSize',
  'widows',
  'zIndex',
  'zoom',
  // SVG 相关
  'fillOpacity',
  'floodOpacity',
  'stopOpacity',
  'strokeDasharray',
  'strokeDashoffset',
  'strokeMiterlimit',
  'strokeOpacity',
  'strokeWidth',
  // 已知前缀属性
  'MozAnimationIterationCount',
  'MozBoxFlex',
  'MozBoxFlexGroup',
  'MozLineClamp',
  'msAnimationIterationCount',
  'msFlex',
  'msZoom',
  'msFlexGrow',
  'msFlexNegative',
  'msFlexOrder',
  'msFlexPositive',
  'msFlexShrink',
  'msGridColumn',
  'msGridColumnSpan',
  'msGridRow',
  'msGridRowSpan',
  'WebkitAnimationIterationCount',
  'WebkitBoxFlex',
  'WebKitBoxFlexGroup',
  'WebkitBoxOrdinalGroup',
  'WebkitColumnCount',
  'WebkitColumns',
  'WebkitFlex',
  'WebkitFlexGrow',
  'WebkitFlexPositive',
  'WebkitFlexShrink',
  'WebkitLineClamp',
])

/** 是否为 unitless CSS 属性（数字不加 px） */
export function isUnitlessNumber(name: string): boolean {
  return UNITLESS.has(name)
}

/** 布尔属性：值为 true 时输出空属性（disabled/checked/readonly/required…） */
export const BOOLEAN_ATTRS = new Set([
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
  'async',
])

/**
 * enumerated 属性：值与布尔不同，true→'true'、false→'false' 字符串
 * （contenteditable="" 虽仍可编辑，但值形态与 React/Vue 不一致，
 * 且 false 应显式输出 'false' 而非移除）。
 */
export const ENUMERATED_ATTRS = new Set([
  'contenteditable',
  'draggable',
  'spellcheck',
])

/** 是否为 enumerated 属性 */
export function isEnumeratedAttr(name: string): boolean {
  return ENUMERATED_ATTRS.has(name)
}

/**
 * style 值规范化：null/undefined/false 跳过（React 语义，不输出）；
 * 非 0 数字 + 非 unitless + 非 CSS 变量 → 补 px；0 → '0'；其余原样字符串。
 * 客户端 CSSOM（el.style[k]=1 自动补 px）与此保持一致，两端同规则。
 */
export function normalizeStyleValue(
  key: string,
  value: unknown,
): string | null {
  if (value == null || value === false) return null
  if (typeof value === 'number') {
    if (value === 0) return '0'
    if (!isUnitlessNumber(key) && !key.startsWith('--')) return `${value}px`
    return String(value)
  }
  return String(value)
}

/**
 * class 合并（对齐 Vue normalizeClass）：
 *   'a'                    → 'a'
 *   ['a', ok && 'b']       → 'a b'
 *   { a: true, b: false }  → 'a'
 *   null/undefined/false 跳过；数组递归展平。
 */
export function normalizeClass(value: unknown): string {
  if (value == null || value === false || value === true) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    const parts: string[] = []
    for (const item of value) {
      const s = normalizeClass(item)
      if (s) parts.push(s)
    }
    return parts.join(' ')
  }
  if (typeof value === 'object') {
    const parts: string[] = []
    for (const k in value) {
      if ((value as Record<string, unknown>)[k]) parts.push(k)
    }
    return parts.join(' ')
  }
  return ''
}

// ============================================================
// P1：React 分组属性决策（照抄 ReactDOMComponent.setProp 语义，
//   2026-08 React 快照）—— resolveAttr 双端（setProp / serializeAttrs）共用
// ============================================================

/** xlink / xml 命名空间（与 React DOMNamespaces 一致） */
export const XLINK_NS = 'http://www.w3.org/1999/xlink'
export const XML_NS = 'http://www.w3.org/XML/1998/namespace'

/** javascript: URL 清洗正则（照抄 React shared/sanitizeURL.js）：
 *  防 C0 控制符/空格前缀 + 内部换行制表混淆的 javascript: 变体 */
const isJavaScriptProtocol =
  /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*\:/i

/** URL 清洗：命中 javascript: → 替换为会抛错的 URL（React 语义），否则原样 */
export function sanitizeURL(url: string): string {
  if (isJavaScriptProtocol.test(url)) {
    return "javascript:throw new Error('ActView has blocked a javascript: URL as a security precaution.')"
  }
  return url
}

/** 属性解析结果：双端外壳按 op 执行 */
export interface ResolvedAttr {
  name: string
  op: 'remove' | 'set' | 'boolean' | 'setNS'
  value?: string
  ns?: string
}

// ---- 分组值规范化（React 各 case 语义）----

/** plain（setValueForKnownAttribute 语义）：null/undefined/function/symbol/
 *  boolean → 移除；否则字符串化 */
function resolvePlainAttr(name: string, value: unknown): ResolvedAttr {
  if (
    value == null ||
    typeof value === 'function' ||
    typeof value === 'symbol' ||
    typeof value === 'boolean'
  ) {
    return { name, op: 'remove' }
  }
  return { name, op: 'set', value: String(value) }
}

/** enumerated（Booleanish String）：true→"true"、false→"false" 字符串化 */
function resolveEnumeratedAttr(name: string, value: unknown): ResolvedAttr {
  if (value != null && typeof value !== 'function' && typeof value !== 'symbol') {
    return { name, op: 'set', value: '' + value }
  }
  return { name, op: 'remove' }
}

/** 布尔：真值 → 裸属性（SSR）/ setAttribute('')（客户端）；假值 → 移除 */
function resolveBooleanAttr(name: string, value: unknown): ResolvedAttr {
  if (value && typeof value !== 'function' && typeof value !== 'symbol') {
    return { name, op: 'boolean' }
  }
  return { name, op: 'remove' }
}

/** overloaded（capture/download）：true→裸属性、false→移除、其他值→值 */
function resolveOverloadedAttr(name: string, value: unknown): ResolvedAttr {
  if (value === true) return { name, op: 'boolean' }
  if (
    value !== false &&
    value != null &&
    typeof value !== 'function' &&
    typeof value !== 'symbol'
  ) {
    return { name, op: 'set', value: String(value) }
  }
  return { name, op: 'remove' }
}

/** 正数（cols/rows/size/span）：数值 >= 1 才输出 */
function resolvePositiveNumericAttr(name: string, value: unknown): ResolvedAttr {
  if (
    value != null &&
    typeof value !== 'function' &&
    typeof value !== 'symbol' &&
    !isNaN(value as number) &&
    (value as number) >= 1
  ) {
    return { name, op: 'set', value: String(value) }
  }
  return { name, op: 'remove' }
}

/** 数字（rowSpan/start）：!isNaN 才输出 */
function resolveNumericAttr(name: string, value: unknown): ResolvedAttr {
  if (
    value != null &&
    typeof value !== 'function' &&
    typeof value !== 'symbol' &&
    !isNaN(value as number)
  ) {
    return { name, op: 'set', value: String(value) }
  }
  return { name, op: 'remove' }
}

/** URL 组（href/src/action/formAction/data[object]）：空串移除（a href 保留）、
 *  javascript: 清洗（tag 大小写兼容：客户端 el.tagName 为大写，SSR 标签为小写） */
function resolveUrlAttr(
  name: string,
  value: unknown,
  key: string,
  tag: string,
): ResolvedAttr {
  if (value === '' && !(tag.toLowerCase() === 'a' && key === 'href')) {
    return { name, op: 'remove' }
  }
  if (
    value == null ||
    typeof value === 'function' ||
    typeof value === 'symbol' ||
    typeof value === 'boolean'
  ) {
    return { name, op: 'remove' }
  }
  return { name, op: 'set', value: sanitizeURL(String(value)) }
}

/** 命名空间组（xlink 与 xml 前缀）：xlink:href 额外 URL 清洗 */
function resolveNsAttr(
  name: string,
  ns: string,
  value: unknown,
  isUrl: boolean,
): ResolvedAttr {
  if (
    value == null ||
    typeof value === 'function' ||
    typeof value === 'symbol' ||
    typeof value === 'boolean'
  ) {
    return { name, op: 'remove' }
  }
  const raw = String(value)
  return { name, op: 'setNS', ns, value: isUrl ? sanitizeURL(raw) : raw }
}

/** React 布尔组（照抄 setProp 布尔 case 列表）
 *   + ActView 补充键：checked/selected/autofocus 等在 React 里由受控 wrapper /
 *   polyfill 处理、不落 switch；ActView 无 wrapper，为 SSR/客户端双端一致
 *   走布尔 attribute（浏览器 IDL 反射保证行为一致）。 */
const BOOLEAN_GROUP = new Set([
  'inert', 'allowFullScreen', 'async', 'autoPlay', 'controls', 'credentialless',
  'default', 'defer', 'disabled', 'disablePictureInPicture', 'disableRemotePlayback',
  'formNoValidate', 'hidden', 'loop', 'noModule', 'noValidate', 'open',
  'playsInline', 'readOnly', 'required', 'reversed', 'scoped', 'seamless', 'itemScope',
  'checked', 'selected', 'autofocus', 'novalidate',
])

/** enumerated 组（React：Booleanish String，value 也在内但受控入口先行分流） */
const ENUMERATED_GROUP = new Set([
  'contentEditable', 'spellCheck', 'draggable', 'value',
  'autoReverse', 'externalResourcesRequired', 'focusable', 'preserveAlpha',
])

/** xlink 命名空间组（[属性名, 是否 URL 需清洗]） */
const XLINK_GROUP: Record<string, [string, boolean]> = {
  xlinkHref: ['xlink:href', true],
  xlinkActuate: ['xlink:actuate', false],
  xlinkArcrole: ['xlink:arcrole', false],
  xlinkRole: ['xlink:role', false],
  xlinkShow: ['xlink:show', false],
  xlinkTitle: ['xlink:title', false],
  xlinkType: ['xlink:type', false],
}

/** xml 命名空间组 */
const XML_GROUP: Record<string, string> = {
  xmlBase: 'xml:base',
  xmlLang: 'xml:lang',
  xmlSpace: 'xml:space',
}

/**
 * React 分组属性决策（照抄 ReactDOMComponent.setProp，2026-08 快照）。
 * 行为分支（事件/class/style/受控 value/checked/dangerouslySetInnerHTML/
 * scopedId/aria-data）由双端外壳在入口先行分流，本函数只处理纯属性序列化。
 *
 * 与 React 的有意偏离：
 *   - multiple/muted：React 走 property coerce；ActView 走布尔 attribute
 *     （浏览器 IDL 反射保证行为一致，且保住 ActView SSR/客户端双端一致）
 *   - autoFocus：React 客户端 noop（polyfill 架构）；ActView 无 polyfill，
 *     保留 attribute 让浏览器原生生效
 */
export function resolveAttr(key: string, value: unknown, tag: string): ResolvedAttr {
  const name = HTML_ATTR_OVERRIDES[key] ?? key
  switch (key) {
    case 'dir':
    case 'role':
    case 'viewBox':
    case 'width':
    case 'height':
      return resolvePlainAttr(key, value)
    case 'defaultValue':
      // SSR：defaultValue → value 属性（React createMarkupForProperty 语义；
      // 客户端在受控入口分流为 property）
      return resolvePlainAttr('value', value)
    case 'defaultChecked':
      // SSR：defaultChecked → checked 布尔裸属性
      return resolveBooleanAttr('checked', value)
    case 'data':
      // <object data> 是 URL；其余 data 走 plain attribute
      if (tag !== 'object') return resolvePlainAttr('data', value)
      return resolveUrlAttr('data', value, key, tag)
    case 'src':
    case 'href':
    case 'action':
    case 'formAction':
      return resolveUrlAttr(name, value, key, tag)
    case 'multiple':
    case 'muted':
      // React 走 property coerce；ActView 布尔 attribute（双端一致，反射保行为）
      return resolveBooleanAttr(name, value)
    case 'capture':
    case 'download':
      return resolveOverloadedAttr(name, value)
    case 'cols':
    case 'rows':
    case 'size':
    case 'span':
      return resolvePositiveNumericAttr(name, value)
    case 'rowSpan':
    case 'start':
      return resolveNumericAttr(name, value)
    case 'popover':
    case 'is':
      return resolvePlainAttr(name, value)
    default:
      break
  }
  if (key in XLINK_GROUP) {
    const [n, isUrl] = XLINK_GROUP[key]
    return resolveNsAttr(n, XLINK_NS, value, isUrl)
  }
  if (key in XML_GROUP) {
    return resolveNsAttr(XML_GROUP[key], XML_NS, value, false)
  }
  if (ENUMERATED_GROUP.has(key)) return resolveEnumeratedAttr(name, value)
  // 分组查询兼容 key 与规范化名（HTML_ATTR_OVERRIDES）：autoFocus → autofocus
  // 等 camelCase prop 需命中小写布尔键（如 BOOLEAN_GROUP 的 'autofocus'）。
  if (BOOLEAN_GROUP.has(key) || BOOLEAN_GROUP.has(name)) {
    return resolveBooleanAttr(name, value)
  }
  return resolvePlainAttr(name, value)
}
