import { ref } from '@actview/core'

function Welcome(props: { name: string }) {
  return () => (
    <div class="demo-card">
      <div class="badge-setup">Setup 模式</div>
      <h3>欢迎</h3>
      <p>你好，<strong>{props.name}</strong>！</p>
    </div>
  )
}

export function ComponentsDemo() {
  const name = ref('Actview')

  return () => (
    <div class="guide-content">
      <h2>组件</h2>
      <p>Actview 支持两种组件写法，均通过 JSX 工厂的 <code>mountComponent</code> 挂载。</p>

      <h3 style="margin-top:1.5rem">两种模式对比</h3>
      <table class="compare-table">
        <thead>
          <tr><th>特性</th><th>Setup 模式</th><th>直接模式</th></tr>
        </thead>
        <tbody>
          <tr><td>写法</td><td>返回 render 函数</td><td>直接返回 JSX</td></tr>
          <tr><td>响应式状态</td><td>✅ 支持 ref/reactive</td><td>❌ 无内部状态</td></tr>
          <tr><td>更新粒度</td><td>组件级独立更新</td><td>父级重建</td></tr>
          <tr><td>适合场景</td><td>有状态的业务组件</td><td>纯展示组件</td></tr>
        </tbody>
      </table>

      <div class="code-block">{`// Setup 模式（推荐）
function Counter() {
  const count = ref(0)
  return () => <div>{count.value}</div>
}

// 直接模式（兼容）
function Card(props) {
  return <div>{props.title}</div>
}`}</div>

      <div class="demo-row">
        <Welcome name={name.value} />
      </div>
      <div class="demo-row">
        <button onClick={() => name.value = '世界'}>设为"世界"</button>
        <button onClick={() => name.value = 'Actview'}>设为"Actview"</button>
        <button onClick={() => name.value = '开发者'}>设为"开发者"</button>
      </div>
    </div>
  )
}
