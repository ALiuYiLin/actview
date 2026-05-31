import { createApp } from '@actview/core'
import type { VNode } from '@actview/jsx'
import './style.css'

// ============================================================
// 组件 — 使用 JSX 描述 UI
// JSX 编译后自动调用 @actview/jsx 的 jsx() 返回 VNode
// ============================================================

interface GreetProps {
  name: string
  age?: number
}

function Greet(props: GreetProps): VNode {
  return (
    <div class="greet">
      <h1>Hello, {props.name}!</h1>
      {props.age && <p>Age: {props.age}</p>}
      <button onclick={() => console.log('clicked!')}>
        Click me
      </button>
    </div>
  )
}

// ============================================================
// 挂载 — App.mount(Component, selector)
// 内部执行 render(VNode) → 真实 DOM
// ============================================================

const app = createApp()
app.mount(Greet, '#app')
