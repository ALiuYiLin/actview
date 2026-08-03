// ============================================================
// 一次性验证脚本：最小 DOM stub 下跑通
//   挂载 → 响应式更新 → patch / keyed diff / props 细粒度更新
// 运行：node scripts/verify.mjs
// ============================================================

// ---------- 最小 DOM stub ----------
function makeElement(tag) {
  const children = []
  const attrs = {}
  return {
    tagName: String(tag).toLowerCase(),
    children,
    attrs,
    className: '',
    style: {},
    textContent: '',
    value: '',
    checked: false,
    parentNode: null,
    get childNodes() { return children },
    set innerHTML(_v) { children.length = 0 },
    appendChild(c) {
      // 真实 DOM 语义：已挂载节点先移除再追加（移动）
      if (c.parentNode === this) {
        const i = children.indexOf(c)
        if (i >= 0) children.splice(i, 1)
      } else if (c.parentNode) {
        c.parentNode.removeChild(c)
      }
      c.parentNode = this
      children.push(c)
      return c
    },
    removeChild(c) { const i = children.indexOf(c); if (i >= 0) children.splice(i, 1); c.parentNode = null; return c },
    replaceChild(n, o) { const i = children.indexOf(o); if (i >= 0) children[i] = n; n.parentNode = this; o.parentNode = null; return o },
    setAttribute(k, v) { attrs[k] = String(v) },
    removeAttribute(k) { delete attrs[k] },
  }
}
function makeText(text) {
  return { nodeType: 3, textContent: String(text), data: String(text), parentNode: null }
}
const hosts = new Map()
globalThis.document = {
  createElement: makeElement,
  createTextNode: makeText,
  querySelector(sel) {
    if (sel.startsWith('#')) {
      if (!hosts.has(sel)) hosts.set(sel, makeElement('div'))
      return hosts.get(sel)
    }
    return null
  },
}

// ---------- 挂载并验证 ----------
const { createServer } = await import('vite')
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })

function dump(el, indent = '') {
  if (!el) return '(null)'
  if (el.nodeType === 3) return `${indent}"text"="${el.textContent}"`
  const attrs = Object.keys(el.attrs).length
    ? ' ' + Object.entries(el.attrs).map(([k, v]) => `${k}="${v}"`).join(' ')
    : ''
  let out = `${indent}<${el.tagName}${attrs}${el.value !== undefined && el.value !== '' ? ` value=${JSON.stringify(el.value)}` : ''}`
  if (!el.children.length) return out + ' />'
  out += '>\n'
  for (const c of el.children) out += dump(c, indent + '  ') + '\n'
  return out + indent + `</${el.tagName}>`
}

function texts(ulEl) {
  return ulEl.children.map((li) => li.children[0].textContent)
}

let pass = 0
let fail = 0
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name}`) }
}

try {
  const mod = await server.ssrLoadModule('/scripts/verify-entry.tsx')
  globalThis.__mod = mod

  // ---------- 场景 1：响应式自动更新 ----------
  console.log('--- 场景 1：响应式文本自动更新 ---')
  const appHost = hosts.get('#app')
  check('挂载后 count 文本为 "1"', appHost.children[0].children[0].children[1].textContent === '1')
  globalThis.__triggerUpdate()
  check('count=42 后文本自动更新为 "42"', appHost.children[0].children[0].children[1].textContent === '42')

  // ---------- 场景 2：keyed diff ----------
  console.log('--- 场景 2：keyed diff ---')
  const listHost = hosts.get('#list')
  const ul = listHost.children[0]
  check('初始列表为 a,b,c', JSON.stringify(texts(ul)) === JSON.stringify(['a', 'b', 'c']))

  globalThis.__setItems(['c', 'a', 'b'])
  check('重排为 c,a,b（keyed 复用 + 移动）', JSON.stringify(texts(ul)) === JSON.stringify(['c', 'a', 'b']))

  globalThis.__setItems(['a', 'd'])
  check('删除+新增后为 a,d', JSON.stringify(texts(ul)) === JSON.stringify(['a', 'd']))

  globalThis.__setItems(['x', 'a', 'd'])
  check('头部新增后为 x,a,d', JSON.stringify(texts(ul)) === JSON.stringify(['x', 'a', 'd']))

  // ---------- 场景 3：props 细粒度更新 ----------
  console.log('--- 场景 3：props 细粒度更新 ---')
  const parentHost = hosts.get('#parent')
  const span = parentHost.children[0].children[0]
  const setupAfterMount = globalThis.__getSetupCount()
  check('子组件 setup 只执行一次', setupAfterMount === 1)
  check('初始 msg 为 "hello"', span.children[0].textContent === 'hello')

  globalThis.__setMsg('world')
  check('msg 更新为 "world"（未重挂）', span.children[0].textContent === 'world')
  check('子组件 setup 仍只执行一次（DOM 复用）', globalThis.__getSetupCount() === 1)
  check('span 元素引用未变（精确更新而非重建）', span === parentHost.children[0].children[0])

  // ---------- 冒烟：src/main.tsx 检验页能正常渲染 ----------
  console.log('--- 冒烟：src/main.tsx 检验页 ---')
  await server.ssrLoadModule('/src/main.tsx')
  const pageHost = hosts.get('#app')
  const appRoot = pageHost.children[0]
  check('页面根元素已挂载', !!appRoot && appRoot.tagName === 'div')
  const titles = appRoot.children.map((c) => c.children[0] && c.children[0].textContent)
  check('含标题', titles.some((t) => t === 'actview — 响应式前端框架检验页'))
  const cards = appRoot.children.filter((c) => c.className === 'demo-card')
  check('渲染出 4 个 demo 卡片', cards.length === 4)
  // 卡片顺序固定：Counter, KeyedList, PropsDemo, Toggle（ul 是 KeyedList 卡片的第 2 个子节点）
  check('keyed 列表初始 3 项', cards[1] && cards[1].children[1].children.length === 3)

  console.log(`\n${pass} 通过 / ${fail} 失败`)
  process.exitCode = fail === 0 ? 0 : 1
} finally {
  await server.close()
}
