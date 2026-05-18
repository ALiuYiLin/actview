import { ref } from '@actview/core'

export function OptionDemo() {
  const count = ref(0)
  const inputText = ref('')

  return () => (
    <div class="guide-content">
      <h2>Option 编译</h2>
      <p>通过 <code>selector + Option</code> 声明式绑定 DOM 行为，无需模板指令。</p>

      <h3 style="margin-top:1.5rem">text — 文本绑定</h3>
      <div class="code-block">{`{ selector: '#output', text: () => \`计数: \${count.value}\` }`}</div>
      <div class="demo-row">
        <button onClick={() => count.value++}>+1</button>
        <span id="option-text-output" style="margin-left:0.5rem">{count.value}</span>
      </div>

      <h3 style="margin-top:1.5rem">bind — 属性绑定</h3>
      <p><code>bind</code> 让属性独立订阅，变化时只更新对应属性，不触发 render。</p>
      <div class="code-block">{`{
  selector: '#demo-input',
  bind: { value: () => inputText.value }
}`}</div>
      <div class="demo-row">
        <input class="demo-input" placeholder="输入文字" id="demo-input" onInput={(e: any) => inputText.value = e.target.value} />
        <span>预览：<strong class="hl">{inputText.value || '（空）'}</strong></span>
      </div>

      <h3 style="margin-top:1.5rem">render — DOM 渲染</h3>
      <p><code>render</code> 函数返回 JSX/DOM，支持多个函数（前 N-1 个是计算，最后是模板）。</p>
      <div class="code-block">{`{
  selector: '#app',
  render: [
    () => { a.value = b.value * 2 },
    () => <div>{a.value}</div>,
  ]
}`}</div>
    </div>
  )
}
