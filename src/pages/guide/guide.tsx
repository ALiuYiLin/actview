import { ref, reactive, computed } from '@actview/core'
import './index.css'

// ============ 导航 tabs ============
type Tab = 'reactive' | 'computed' | 'jsx' | 'option' | 'components'

const tabs: { key: Tab; label: string; icon: string }[] = [
  { key: 'reactive', label: '响应式基础', icon: '⚡' },
  { key: 'computed', label: '计算与侦听', icon: '📡' },
  { key: 'jsx', label: 'JSX 渲染', icon: '🖼️' },
  { key: 'option', label: 'Option 编译', icon: '⚙️' },
  { key: 'components', label: '组件', icon: '🧩' },
]

// ============ 各节内容 ============

function ReactiveDemo() {
  // ref
  const count = ref(0)
  // reactive
  const user = reactive({ name: '张三', age: 25 })
  const tags = reactive(['Vue', 'React', 'Actview'])

  return () => (
    <div class="guide-content">
      <h2>ref — 基础响应式数据</h2>
      <p><code>ref</code> 将任意值包装为响应式对象，通过 <code>.value</code> 读写。</p>
      <div class="code-block">{`const count = ref(0)
count.value++  // → 1`}</div>
      <div class="demo-row">
        <span>count：<strong class="hl">{count.value}</strong></span>
        <button onClick={() => count.value++}>+1</button>
        <button onClick={() => count.value--}>-1</button>
        <button onClick={() => count.value = 0}>重置</button>
      </div>

      <h2 style="margin-top:2rem">reactive — 响应式对象/数组</h2>
      <p><code>reactive</code> 用 Proxy 代理对象，访问属性时自动收集依赖。</p>
      <div class="code-block">{`const user = reactive({ name: '张三', age: 25 })
user.age = 26  // → UI 更新`}</div>
      <div class="demo-row">
        <span>{user.name}，{user.age} 岁</span>
        <button onClick={() => user.age++}>年龄 +1</button>
        <button onClick={() => user.name = user.name === '张三' ? '李四' : '张三'}>切换名字</button>
      </div>

      <p style="margin-top:1rem">reactive 数组支持 push/pop/unshift/shift/splice/sort 等变更方法。</p>
      <div class="code-block">{`const tags = reactive(['Vue', 'React', 'Actview'])
tags.push('Svelte')     // → 触发更新
tags.sort(() => Math.random() - 0.5)  // → 随机排序`}</div>
      <div class="demo-row">
        {tags.map(t => <span class="tag" key={t}>{t}</span>)}
      </div>
      <div class="demo-row">
        <button onClick={() => tags.push('Svelte')}>尾部添加</button>
        <button onClick={() => tags.shift()}>头部删除</button>
        <button onClick={() => tags.sort(() => Math.random() - 0.5)}>随机排序</button>
      </div>
    </div>
  )
}

function ComputedDemo() {
  const price = ref(100)
  const quantity = ref(2)
  const total = computed(() => price.value * quantity.value)
  const firstName = ref('张')
  const lastName = ref('三')
  const fullName = computed(() => `${firstName.value}${lastName.value}`)

  return () => (
    <div class="guide-content">
      <h2>computed — 计算属性</h2>
      <p><code>computed</code> 基于其他响应式数据推导出新值，且结果会被缓存。</p>
      <div class="code-block">{`const price = ref(100)
const quantity = ref(2)
const total = computed(() => price.value * quantity.value)`}</div>
      <div class="demo-row">
        <span>单价：<strong class="hl">{price.value}</strong></span>
        <button onClick={() => price.value += 10}>+10</button>
        <button onClick={() => price.value = Math.max(0, price.value - 10)}>-10</button>
      </div>
      <div class="demo-row">
        <span>数量：<strong class="hl">{quantity.value}</strong></span>
        <button onClick={() => quantity.value++}>+1</button>
        <button onClick={() => quantity.value = Math.max(0, quantity.value - 1)}>-1</button>
      </div>
      <div class="demo-row result">
        总价：<strong class="hl">{total.value}</strong> 元
      </div>

      <h2 style="margin-top:2rem">字符串拼接</h2>
      <div class="code-block">{`const firstName = ref('张')
const lastName = ref('三')
const fullName = computed(() => firstName.value + lastName.value)`}</div>
      <div class="demo-row">
        <span>姓：</span>
        <button onClick={() => firstName.value = '李'}>设为"李"</button>
        <button onClick={() => firstName.value = '王'}>设为"王"</button>
        <span style="margin-left:1rem">名：</span>
        <button onClick={() => lastName.value = '四'}>设为"四"</button>
        <button onClick={() => lastName.value = '五'}>设为"五"</button>
      </div>
      <div class="demo-row result">
        完整姓名：<strong class="hl">{fullName.value}</strong>
      </div>
    </div>
  )
}

function JsxDemo() {
  const items = reactive(['A', 'B', 'C'])
  let nextId = 4
  const show = ref(true)

  return () => (
    <div class="guide-content">
      <h2>JSX 渲染</h2>
      <p>使用 <code>@actview/jsx</code> 作为 JSX 运行时，将 JSX 编译为真实 DOM 操作。</p>

      <h3 style="margin-top:1.5rem">列表渲染</h3>
      <p>使用数组的 <code>map</code> 方法生成列表，配合 <code>key</code> 属性启用 keyed diff。</p>
      <div class="code-block">{`{items.map(item => (
  <li key={item}>{item}</li>
))}`}</div>
      <ul class="demo-list">
        {items.map((item, i) => (
          <li key={item}>
            <span class="idx">{i}</span>
            <span>{item}</span>
            <input placeholder={`备注 ${item}`} />
            <button class="btn-sm" onClick={() => items.splice(i, 1)}>删除</button>
          </li>
        ))}
      </ul>
      <div class="demo-row">
        <button onClick={() => items.push(String.fromCharCode(64 + nextId++))}>添加</button>
        <button onClick={() => items.unshift(String.fromCharCode(64 + nextId++))}>头部插入</button>
        <button onClick={() => items.sort(() => Math.random() - 0.5)}>排序</button>
      </div>

      <h3 style="margin-top:1.5rem">条件渲染</h3>
      <div class="code-block">{`{show.value ? <p>显示</p> : null}`}</div>
      <div class="demo-row">
        <button onClick={() => show.value = !show.value}>切换显示</button>
        {show.value ? <span class="tag" style="margin-left:0.5rem">当前显示</span> : null}
      </div>
    </div>
  )
}

function OptionDemo() {
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

function ComponentsDemo() {
  const name = ref('Actview')

  // setup 模式子组件
  function Welcome() {
    return () => (
      <div class="demo-card">
        <div class="badge-setup">Setup 模式</div>
        <h3>欢迎</h3>
        <p>你好，<strong>{name.value}</strong>！count 的变化也会触发本组件更新。</p>
      </div>
    )
  }

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
  const count = ref(0)              // setup 阶段只执行一次
  return () => <div>{count.value}</div>  // render 函数独立更新
}

// 直接模式（兼容）
function Card(props) {
  return <div>{props.title}</div>    // 每次父级更新会重建
}`}</div>

      <div class="demo-row">
        <Welcome />
      </div>
      <div class="demo-row">
        <button onClick={() => name.value = '世界'}>设为"世界"</button>
        <button onClick={() => name.value = 'Actview'}>设为"Actview"</button>
        <button onClick={() => name.value = '开发者'}>设为"开发者"</button>
      </div>
    </div>
  )
}

// ============ Tab 切换组件 ============
function TabNav(props: { active: Tab; tabs: typeof tabs; onTab: (t: Tab) => void }) {
  return (
    <nav class="guide-nav">
      {props.tabs.map(t => (
        <button
          key={t.key}
          class={props.active === t.key ? 'active' : ''}
          onClick={() => props.onTab(t.key)}
        >
          <span class="nav-icon">{t.icon}</span>
          <span class="nav-label">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}

// ============ 主页面 ============
export function Guide() {
  const activeTab = ref<Tab>('reactive')

  return () => {
    const tab = activeTab.value

    return (
      <div class="guide-page">
        <div class="guide-header">
          <h1>指南</h1>
          <p class="guide-subtitle">Actview 框架核心概念与使用示例</p>
        </div>

        <TabNav active={tab} tabs={tabs} onTab={(t) => activeTab.value = t} />

        <div class="guide-body">
          {tab === 'reactive' && <ReactiveDemo />}
          {tab === 'computed' && <ComputedDemo />}
          {tab === 'jsx' && <JsxDemo />}
          {tab === 'option' && <OptionDemo />}
          {tab === 'components' && <ComponentsDemo />}
        </div>
      </div>
    )
  }
}
