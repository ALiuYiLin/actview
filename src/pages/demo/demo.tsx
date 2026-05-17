import { reactive, ref, watch } from '@actview/core'
import './index.css'

// ====== Setup 模式（推荐）======

function CounterSetup() {
  const count = ref(0)

  return () => (
    <div class="demo-card">
      <div class="demo-badge setup">Setup 模式</div>
      <h3>计数器（响应式）</h3>
      <p class="demo-desc">setup 阶段只执行一次，render 函数每次更新重新执行，依赖自动收集。</p>
      <div class="demo-value">{count.value}</div>
      <div class="demo-actions">
        <button onClick={() => count.value++}>+1</button>
        <button onClick={() => count.value--}>-1</button>
        <button onClick={() => count.value = 0}>重置</button>
      </div>
    </div>
  )
}

function ListSetup() {
  const items = reactive(['A', 'B', 'C'])
  let nextId = 4

  return () => (
    <div class="demo-card">
      <div class="demo-badge setup">Setup 模式</div>
      <h3>列表（带 key）</h3>
      <p class="demo-desc">reactive 数组在 setup 中创建，render 中 <code>map</code> 渲染。</p>
      <div class="demo-actions">
        <button onClick={() => items.push(String.fromCharCode(64 + nextId++))}>尾部添加</button>
        <button onClick={() => items.shift()}>头部删除</button>
        <button onClick={() => items.sort(() => Math.random() - 0.5)}>随机排序</button>
      </div>
      <ul class="demo-list">
        {items.map((item, i) => (
          <li key={item}>
            <span class="demo-idx">{i}</span>
            <span>{item}</span>
            <input placeholder={`备注 ${item}`} />
          </li>
        ))}
      </ul>
    </div>
  )
}

// ====== 直接模式（兼容）======

function GreetingDirect(props: { name?: string }) {
  return (
    <div class="demo-card">
      <div class="demo-badge direct">直接模式</div>
      <h3>问候（无状态）</h3>
      <p class="demo-desc">直接返回 DOM，每次父级更新会重建，适合纯展示组件。</p>
      <p class="demo-greeting">你好，{props.name || '世界'}！</p>
    </div>
  )
}

function BadgeDirect(props: { type?: string; label?: string }) {
  const cls = ['badge', props.type ? `badge-${props.type}` : 'badge-default'].filter(Boolean).join(' ')
  return (
    <div class="demo-card">
      <div class="demo-badge direct">直接模式</div>
      <h3>标签（纯展示）</h3>
      <p class="demo-desc">运行简单的逻辑后直接返回 JSX，没有内部状态。</p>
      <div class="demo-badges">
        <span class={cls}>{props.label || '默认'}</span>
        <span class="badge badge-primary">主要</span>
        <span class="badge badge-success">成功</span>
        <span class="badge badge-danger">危险</span>
      </div>
    </div>
  )
}

// ====== 主页面 ======

export function Demo() {
  const currentName = ref('张三')
  const names = ['张三', '李四', '王五', '赵六']
  const a = ref('@')
  watch(currentName,(val)=>{
    console.log('val: ', val);
    if(val === '李四') a.value = '@'
    else a.value = '!'
  })
  return () => (
    <div class="demo-container">
      <h1>两种组件写法</h1>

      <div class="demo-section">
        <h2>Setup 模式 <span class="tag recommended">推荐</span></h2>
        <p class="section-desc">组件函数返回一个 <code>render</code> 函数。setup 阶段只执行一次（创建 ref/reactive），render 函数在每次更新时重新执行。</p>
        <div class="demo-grid">
          <CounterSetup />
          <ListSetup />
        </div>
      </div>

      <div class="demo-section">
        <h2>直接模式 <span class="tag compat">兼容</span></h2>
        <p class="section-desc">组件函数直接返回 DOM。无内部状态，每次父级更新时会重建，适合纯展示组件。</p>
        <div class="demo-grid">
          <GreetingDirect name={currentName.value} />
          <BadgeDirect type="danger" label="错误" />
        </div>
        <div class="demo-actions" style="margin-top: 1rem;">
          <span>切换 Greeting 的 name：</span>
          {names.map(n => (
            <button key={n} onClick={() => currentName.value = n} class={currentName.value === n ? 'active' : ''}>{n}</button>
          ))}
        </div>
      </div>
      <div>{a.value}</div>
    </div>
  )
}
