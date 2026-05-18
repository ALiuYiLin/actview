import { reactive, ref } from '@actview/core'

export function JsxDemo() {
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
