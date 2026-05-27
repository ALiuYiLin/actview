import { ref } from "actview"

export function App() {
  const counter = ref(1)
  function add(){
    counter.value += 1
    console.log('added',counter.value);
  }
  return () => (
    <div id="app-root">
      <h1>hello</h1>
      <button onClick={add}>{counter.value}</button>
    </div>
  )
}
