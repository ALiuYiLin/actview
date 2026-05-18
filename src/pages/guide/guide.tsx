import { ref } from '@actview/core'
import './index.css'
import { ReactiveDemo } from './reactive-demo'
import { ComputedDemo } from './computed-demo'
import { JsxDemo } from './jsx-demo'
import { OptionDemo } from './option-demo'
import { ComponentsDemo } from './components-demo'

type Tab = 'reactive' | 'computed' | 'jsx' | 'option' | 'components'

const tabs: { key: Tab; label: string; icon: string }[] = [
  { key: 'reactive', label: '响应式基础', icon: '⚡' },
  { key: 'computed', label: '计算与侦听', icon: '📡' },
  { key: 'jsx', label: 'JSX 渲染', icon: '🖼️' },
  { key: 'option', label: 'Option 编译', icon: '⚙️' },
  { key: 'components', label: '组件', icon: '🧩' },
]

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
