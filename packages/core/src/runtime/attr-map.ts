// ============================================================
// React 属性名 → HTML 属性名 映射
//   JSX 里写 camelCase 的 React prop（htmlFor/readOnly/tabIndex…），
//   React DOM 在运行时翻译成真实 HTML 属性名。ActView 的 JSX 编译
//   器只把 prop 名原样保留（见 @actview/plugin-babel 的 compileJsxElement），
//   所以翻译放在这个共享映射表里，由运行时 setProp 与 SSR serializeAttrs
//   的兜底分支统一查表。
// 仅收录「需要改名」的属性；class/className、value/checked、aria-/data-、
// 事件（on*）、dangerouslySetInnerHTML 等由各自分支单独处理（见 renderer.ts）。
// 参考 React DOM 的 properties.js / HTMLDOMPropertyConfig。
// ============================================================

export const HTML_ATTR_OVERRIDES: Record<string, string> = {
  // 全局属性
  htmlFor: 'for',
  tabIndex: 'tabindex',
  readOnly: 'readonly',
  maxLength: 'maxlength',
  minLength: 'minlength',
  autoComplete: 'autocomplete',
  autoFocus: 'autofocus',
  encType: 'enctype',
  acceptCharset: 'accept-charset',
  httpEquiv: 'http-equiv',
  crossOrigin: 'crossorigin',
  noValidate: 'novalidate',
  spellCheck: 'spellcheck',
  contentEditable: 'contenteditable',

  // 表格属性
  colSpan: 'colspan',
  rowSpan: 'rowspan',
  cellPadding: 'cellpadding',
  cellSpacing: 'cellspacing',

  // 媒体 / 链接
  useMap: 'usemap',
  srcSet: 'srcset',
  srcDoc: 'srcdoc',
  hrefLang: 'hreflang',
  inputMode: 'inputmode',

  // form* 覆盖属性
  formAction: 'formaction',
  formEncType: 'formenctype',
  formMethod: 'formmethod',
  formNoValidate: 'formnovalidate',
  formTarget: 'formtarget',
}
