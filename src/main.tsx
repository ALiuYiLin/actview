import { reactive } from "@local/core";



function MyButton(){
  console.log("@@@");
  return <button>1234</button>
}
function App(){
  console.log('App');
  const a = 1
  return (
    <div class="app">
    <span>111{a}</span>
    <input value={1} onchange={e=>console.log(e.target.value)}></input>
    <MyButton class="abc"></MyButton>
  </div>
  )
}

const { __setup } = App as any
console.log('__setup: ', __setup);
const render = __setup()
console.log('render: ', render);
const vnode = render()
console.log('vnode: ', vnode);







