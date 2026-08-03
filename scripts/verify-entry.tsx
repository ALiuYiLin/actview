import { createApp, reactive } from "@local/core"

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

// ---------- 挂载三个应用到不同容器 ----------
createApp(App).mount('#app')
createApp(ListApp).mount('#list')
createApp(Parent).mount('#parent')
