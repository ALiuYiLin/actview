// ============================================================
// @actview/server — HTML document 拼装
// ============================================================

export interface RenderDocumentOptions {
  /** SSR body HTML（renderToHTML().html） */
  html: string
  /** head 片段（renderToHTML().head）；原样插入，调用方负责可信性 */
  head?: string
  /** 初始 state；序列化后写入脚本 */
  state?: Record<string, unknown>
  /** 默认 __ACTVIEW_STATE__ */
  stateVariable?: string
  /** 客户端入口，例如 /src/main.ts */
  clientEntry?: string
  /** 额外 CSS 链接 */
  css?: string | string[]
  lang?: string
  title?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function serializeState(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

export function renderDocument(options: RenderDocumentOptions): string {
  const lang = options.lang ?? 'en'
  const title = options.title
    ? `<title>${escapeHtml(options.title)}</title>`
    : ''
  const css = options.css
    ? (Array.isArray(options.css) ? options.css : [options.css])
        .map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}">`)
        .join('')
    : ''
  const stateVariable = options.stateVariable ?? '__ACTVIEW_STATE__'
  const state =
    options.state && Object.keys(options.state).length
      ? `<script>window.${stateVariable}=${serializeState(options.state)}</script>`
      : ''
  const clientEntry = options.clientEntry
    ? `<script type="module" src="${escapeHtml(options.clientEntry)}"></script>`
    : ''

  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${title}${css}${options.head ?? ''}
</head>
<body>
${options.html}
${state}${clientEntry}
</body>
</html>`
}
