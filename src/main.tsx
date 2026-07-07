


import { mountComponent } from '@local/core'
function MyButton(){
  console.log("@@@");
  return <button>1234</button>
}
function App(){
  return (
  <div class="app">
    <span>111</span>
    <MyButton></MyButton>
  </div>
  )
}
const container = document.getElementById('app')!
mountComponent(App, container)


