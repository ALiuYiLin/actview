import { createApp, ref } from '@actview/core'
import './style.css'

// ============================================================
// 组件：()=>()=>VNode
// - 外层函数：setup，收 props 和创建响应式数据（只执行一次）
// - 内层函数：render，返回 JSX / VNode（每次更新都执行）
// ============================================================

function MyButton(props:{count: number}){
  return ()=><div>{props.count}</div>
}
function Greet(props: { name: string }){
  const age = ref(0)
  return () => (
    <div class="greet">
      <h1>Hello, {props.name}!</h1>
      <p>Age: {age.value}</p>
      <button onclick={() => age.value++}>Click me</button>
      <MyButton count={age.value}></MyButton>
    </div>
  )
}

// ============================================================
// 挂载
// ============================================================

const app = createApp()
app.mount(Greet, '#app')
