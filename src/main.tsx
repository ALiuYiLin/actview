


import { mountComponent } from '@local/core'
function MyButton(){
  console.log("@@@");
  return <button>1234</button>
}
function App(){
  console.log('App');
  return (
    <div class="app">
    <span>111</span>
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







