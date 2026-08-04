import { createApp, reactive, readonly, shallowReactive, markRaw } from "@local/core"
import { createRouter, createMemoryHistory, RouterLink, RouterView } from "@actview/router"

// ---------- 场景 1：响应式文本 + input ----------
const state = reactive({ count: 1 })

function App() {
  return (
    <div class="app">
      <span>hello: {state.count}</span>
      <input value={state.count} oninput={(e) => { state.count = Number(e.target.value) }} />
      <button class="abc">1234</button>
    </div>
  )
}
globalThis.__triggerUpdate = () => { state.count = 42 }

// ---------- 场景 2：keyed diff（重排 / 增删） ----------
const listState = reactive({ items: ['a', 'b', 'c'] })

function ListApp() {
  return (
    <ul>
      {listState.items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  )
}
globalThis.__setItems = (items) => { listState.items = items }

// ---------- 场景 3：props 细粒度更新 ----------
let childSetupCount = 0

function Child(props) {
  childSetupCount++
  return <span class="child">{props.msg}</span>
}

const parentState = reactive({ msg: 'hello' })

function Parent() {
  return (
    <div class="parent">
      <Child msg={parentState.msg} />
    </div>
  )
}
globalThis.__setMsg = (msg) => { parentState.msg = msg }
globalThis.__getSetupCount = () => childSetupCount

// ---------- 场景 4：子组件内部状态变化不应连带父组件重渲染 ----------
let parentRenderCount = 0
function markParentRender() {
  parentRenderCount++
  return '' // 渲染时计数一次，产生一个空文本节点，不影响布局
}

const innerState = reactive({ local: 'inner' })

function ChildWithLocal(props) {
  return (
    <div class="child-local">
      <span>prop: {props.msg} | local: {innerState.local}</span>
    </div>
  )
}

const parentState2 = reactive({ msg: 'hello2' })

function ParentWithLocal() {
  return (
    <div class="parent-local">
      {markParentRender()}
      <ChildWithLocal msg={parentState2.msg} />
    </div>
  )
}
globalThis.__setParentMsg = (msg) => { parentState2.msg = msg }
globalThis.__setChildLocal = (v) => { innerState.local = v }
globalThis.__getParentRenderCount = () => parentRenderCount

// ---------- 场景 5：路由（RouterView 组件切换） ----------
function Home() {
  return <div class="page home">Home page</div>
}
function About() {
  return <div class="page about">About page</div>
}
function User(props) {
  return <div class="page user">User: {props.params.id}</div>
}

const router = createRouter({
  history: createMemoryHistory('/'),
  routes: [
    { path: '/', component: Home },
    { path: '/about', component: About },
    { path: '/user/:id', component: User },
  ],
})

function RouterApp() {
  return (
    <div class="router-app">
      <nav>
        <RouterLink to="/">Home</RouterLink>
        <RouterLink to="/about">About</RouterLink>
      </nav>
      <RouterView />
    </div>
  )
}
createApp(RouterApp).mount('#router')

globalThis.__router = router

// ---------- 场景 6：数组方法响应（push/pop/splice/reverse/索引赋值） ----------
const arrState = reactive({ items: ['a', 'b', 'c'] })

function ArrApp() {
  return (
    <ul>
      {arrState.items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  )
}
createApp(ArrApp).mount('#arr')

globalThis.__arrPush = (v) => arrState.items.push(v)
globalThis.__arrPop = () => arrState.items.pop()
globalThis.__arrSplice = () => arrState.items.splice(1, 1)
globalThis.__arrReverse = () => arrState.items.reverse()
globalThis.__arrSetIndex = (i, v) => { arrState.items[i] = v }

// ---------- 场景 7：for...in 遍历 / in 操作符响应 ----------
const keysState = reactive({ a: 1, b: 2 })

function collectKeys(obj) {
  const keys: string[] = []
  for (const k in obj) keys.push(k)
  return keys.join(',')
}

function KeysApp() {
  return (
    <div class="keys-app">
      <span class="keys">{collectKeys(keysState)}</span>
      <span class="has-b">{('b' in keysState) ? 'has-b' : 'no-b'}</span>
    </div>
  )
}
createApp(KeysApp).mount('#keys')

globalThis.__addKey = (k, v) => { keysState[k] = v }
globalThis.__delKey = (k) => { delete keysState[k] }

// ---------- 场景 8：markRaw / readonly / shallowReactive / 非普通对象 ----------
const rawMarkedObj = { n: 1 }
const marked = markRaw(rawMarkedObj)

const apiState = reactive({
  d: new Date(0),          // 非普通对象：不代理，调用方法不崩溃
  normal: { n: 1 },        // 普通嵌套对象：响应式
  marked,                  // markRaw 对象：永不代理
})
const ro = readonly({ count: 1, nested: { deep: 1 } })
const sh = shallowReactive({ top: 1, nested: { deep: 1 } })

function ApiApp() {
  return (
    <div class="api-app">
      <span class="date">{apiState.d.getTime()}</span>
      <span class="normal">{apiState.normal.n}</span>
      <span class="marked">{apiState.marked.n}</span>
      <span class="ro">{ro.count}</span>
      <span class="ro-nested">{ro.nested.deep}</span>
      <span class="sh-top">{sh.top}</span>
      <span class="sh-nested">{sh.nested.deep}</span>
    </div>
  )
}
createApp(ApiApp).mount('#api')

globalThis.__changeNormal = () => { apiState.normal.n = 2 }
globalThis.__changeMarked = () => { rawMarkedObj.n = 2 }
globalThis.__changeShTop = () => { sh.top = 2 }
globalThis.__changeShNested = () => { sh.nested.deep = 2 }
globalThis.__tryWriteRo = () => { ro.count = 99 }

// ---------- 挂载四个应用到不同容器 ----------
createApp(App).mount('#app')
createApp(ListApp).mount('#list')
createApp(Parent).mount('#parent')
createApp(ParentWithLocal).mount('#childlocal')
