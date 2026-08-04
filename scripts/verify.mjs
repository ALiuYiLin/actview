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
  let data = String(text)
  return {
    nodeType: 3,
    parentNode: null,
    // 真实 DOM 中 data 与 textContent 互为别名，需同步
    get data() { return data },
    set data(v) { data = String(v) },
    get textContent() { return data },
    set textContent(v) { data = String(v) },
  }
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
// createWebHistory 所需的最小 window stub（初始路径 /）
globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
  location: { pathname: '/', search: '' },
  history: { pushState() {}, replaceState() {}, go() {} },
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

  // ---------- 场景 4：props 更新路径不污染父组件依赖 ----------
  console.log('--- 场景 4：子组件内部状态变化不连带父组件重渲染 ---')
  const clHost = hosts.get('#childlocal')
  function collectText(el) {
    if (!el) return ''
    if (el.nodeType === 3) return el.data
    return (el.children || []).map(collectText).join('')
  }
  check('初始父 render 1 次', globalThis.__getParentRenderCount() === 1)
  check('初始文本含 inner', collectText(clHost).includes('local: inner'))

  // 基线：子组件内部状态变化只触发子组件更新
  globalThis.__setChildLocal('changed')
  check('子文本更新为 changed', collectText(clHost).includes('local: changed'))
  check('父组件未被连带重渲染（render 仍 1 次）', globalThis.__getParentRenderCount() === 1)

  // props 更新：父组件自身应正常重渲染，子组件文本同步
  globalThis.__setParentMsg('hello2!')
  check('props 更新后子文本同步', collectText(clHost).includes('prop: hello2!'))
  check('父组件正常重渲染（render 2 次）', globalThis.__getParentRenderCount() === 2)

  // 核心断言：props 更新路径之后，子内部状态再变化
  // 修复前：props 路径裸调用 instance.update → 子 render 时 activeEffect 是父 effect
  //         → 父 effect 被收集进子内部 state → 连带渲染（render 3 次）
  // 修复后：instance.update = effect.run → 只在子 effect 上下文收集 → 父仍 2 次
  globalThis.__setChildLocal('again')
  check('子文本更新为 again', collectText(clHost).includes('local: again'))
  check('props 路径未污染父依赖（render 仍 2 次）', globalThis.__getParentRenderCount() === 2)

  // ---------- 场景 5：路由（RouterView 组件切换） ----------
  console.log('--- 场景 5：路由（RouterView 组件切换） ---')
  const routerHost = hosts.get('#router')
  check('初始渲染 Home', collectText(routerHost).includes('Home page'))

  globalThis.__router.push('/about')
  check('push /about 切换为 About', collectText(routerHost).includes('About page'))

  globalThis.__router.push('/user/42')
  check('push /user/:id 动态参数正确', collectText(routerHost).includes('User: 42'))

  globalThis.__router.back()
  check('back() 回到 About', collectText(routerHost).includes('About page'))

  // RouterLink 点击导航：nav 里第一个 a 的 onclick
  const navLinks = routerHost.children[0].children[0].children
  navLinks[0].onclick({ preventDefault() {} })
  check('RouterLink 点击导航到 Home', collectText(routerHost).includes('Home page'))
  check('href 属性正确', navLinks[0].attrs.href === '/')

  // ---------- 场景 6：数组方法响应 ----------
  console.log('--- 场景 6：数组方法（push/pop/splice/reverse/索引赋值） ---')
  const arrHost = hosts.get('#arr')
  const liTexts = (host) => host.children[0].children.map((li) => li.children[0].data)
  check('初始 a,b,c', JSON.stringify(liTexts(arrHost)) === JSON.stringify(['a', 'b', 'c']))

  globalThis.__arrPush('d')
  check('push 后 a,b,c,d', JSON.stringify(liTexts(arrHost)) === JSON.stringify(['a', 'b', 'c', 'd']))

  globalThis.__arrPop()
  check('pop 后 a,b,c', JSON.stringify(liTexts(arrHost)) === JSON.stringify(['a', 'b', 'c']))

  globalThis.__arrSplice()
  check('splice(1,1) 后 a,c', JSON.stringify(liTexts(arrHost)) === JSON.stringify(['a', 'c']))

  globalThis.__arrReverse()
  check('reverse 后 c,a', JSON.stringify(liTexts(arrHost)) === JSON.stringify(['c', 'a']))

  globalThis.__arrSetIndex(0, 'x')
  check('索引赋值后 x,a', JSON.stringify(liTexts(arrHost)) === JSON.stringify(['x', 'a']))

  // ---------- 冒烟：src/main.tsx 检验页（路由版） ----------
  console.log('--- 冒烟：src/main.tsx 检验页（路由版） ---')
  await server.ssrLoadModule('/src/main.tsx')
  const routerMod = await server.ssrLoadModule('/src/router.ts')
  const pageHost = hosts.get('#app')
  const appRoot = pageHost.children[0]
  check('页面根元素已挂载', !!appRoot && appRoot.tagName === 'div')
  check('导航含首页/各功能链接', collectText(appRoot).includes('① 响应式'))
  check('初始渲染首页总览', collectText(appRoot).includes('框架能力总览'))
  routerMod.router.push('/reactive')
  check('路由切换渲染响应式页', collectText(appRoot).includes('count ='))
  routerMod.router.push('/list')
  check('路由切换渲染 keyed 列表页', collectText(appRoot).includes('Apple'))

  console.log(`\n${pass} 通过 / ${fail} 失败`)
  process.exitCode = fail === 0 ? 0 : 1
} finally {
  await server.close()
}
