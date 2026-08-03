import { reactive } from "@local/core";



function MyButton(){
  return <button>1234</button>
}

function App(){
  const state = reactive({count: 1})
  return (
    <div class="app">
    <span>hello: {state.count}</span>
    <input value={state.count} onchange={e=>console.log(e.target.value)}></input>
    <MyButton class="abc"></MyButton>
  </div>
  )
}

const {__setup } = App as any
console.log('__setup: ', __setup);
const render = __setup({})
console.log('render: ', render);
const vnode = render()
console.log('vnode: ', vnode);













