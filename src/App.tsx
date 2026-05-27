import { ref } from "actview"

// ====== 子组件（setup 模式）：props 透传问题演示 ======
function Child(props: { value: number }) {
  // setup：只在首次 mount 时执行
  console.log('[Child] setup, props.value =', props.value)

  return () => {
    // re-render 只跑这里，但捕获的是旧 props
    console.log('[Child] render, props.value =', props.value)
    return <span>{props.value}</span>
  }
}

export function App() {
  const counter = ref(1)

  function add() {
    counter.value += 1
    console.log('counter added:', counter.value)
  }

  return () => (
    <div id="app-root">
      <h1>Counter Demo</h1>

      {/* 响应式 ref：正常 */}
      <p>ref: <span>{counter.value}</span></p>

      {/* 作为 props 传入子组件：子组件 setup 模式收不到更新后的值 */}
      <p>props to child: <Child value={counter.value} /></p>

      <button onClick={add}>+1</button>
    </div>
  )
}
