// ============================================================
// attr-utils.ts — 属性/样式规范化共享工具（客户端 setProp 与 SSR
// serializeAttrs/stringifyStyle 双端复用）
//
// 背景：C7/C2/C11 等「SSR 与客户端输出不一致」缺陷的结构性根因是
// 两端各写一套规则。React/Vue 均让双端走同一套规范化（React
// setValueForStyles 双端调用；Vue patchStyle/SSR 同源）。本模块就是
// ActView 的共享规范层起点：布尔属性、enumerated 属性、class 合并、
// style 值（undefined 过滤 + 数字补 px）统一由这里产出。
// ============================================================

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
