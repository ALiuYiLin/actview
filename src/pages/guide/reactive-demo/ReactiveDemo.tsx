import { ref, reactive } from '@actview/core'

export function ReactiveDemo() {
  const count = ref(0)
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
tags.push('Svelte')
tags.sort(() => Math.random() - 0.5)`}</div>
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
