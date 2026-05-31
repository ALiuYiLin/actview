import { formatVNode, type VNode } from '@actview/jsx'
import './style.css'

// ============================================================
// 定义一个简单的 JSX 组件
// JSX 编译后自动调用 @actview/jsx/jsx-runtime 的 jsx()
// 返回 Vue 风格的 VNode 描述对象
// ============================================================

interface GreetProps {
  name: string
  age?: number
}

// 函数组件：接收 props → 返回 VNode
function Greet(props: GreetProps): VNode {
  return (
    <div class="greet">
      <h1>Hello, {props.name}!</h1>
      {props.age && <p>Age: {props.age}</p>}
    </div>
  )
}

// 渲染组件得到 VNode
const vnode = Greet({ name: 'ActView', age: 3 })

// 输出 VNode 结构到页面
const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <div style="text-align:left;padding:2rem;font-family:monospace">
    <h2>JSX → VNode 转换结果</h2>
    <pre style="background:#f5f5f5;padding:1rem;border-radius:8px;overflow:auto">
${JSON.stringify(formatVNode(vnode), null, 2)}
    </pre>
    <p style="color:#888">查看控制台输出原始 VNode</p>
  </div>
`

console.log('VNode:', vnode)
console.log('Formatted:', formatVNode(vnode))
