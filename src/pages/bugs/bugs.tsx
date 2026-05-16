import { reactive, ref } from '@actview/core';
import './index.css'

// ========================
// Bug B：SVGElement 不是 HTMLElement，diffElement 第 412 行 instanceOf 检查跳过
// 表现：SVG 属性（fill、r 等）变更后 UI 不更新
// ========================
function BugB() {
  const color = ref('#3498db');
  const radius = ref(40);

  return () => (
    <div class="bug-card">
      <div class="bug-header">
        <span class="bug-tag">Bug B</span>
        <span class="bug-severity high">高</span>
      </div>
      <h3>SVG 元素无法 Diff 更新</h3>
      <p class="bug-desc">
        <code>diffElement</code> 第 412 行仅处理 <code>instanceof HTMLElement</code>，
        SVGElement 不匹配此分支，属性变化被跳过。
      </p>
      <div class="bug-demo">
        <svg width="200" height="100" viewBox="0 0 200 100">
          <circle cx="50" cy="50" r={radius.value} fill={color.value} />
          <rect x="110" y="20" width="80" height="60" rx="8" fill={color.value} />
        </svg>
      </div>
      <div class="bug-actions">
        <button onClick={() => color.value = color.value === '#3498db' ? '#e74c3c' : '#3498db'}>
          切换颜色 ({color.value})
        </button>
        <button onClick={() => radius.value = radius.value === 40 ? 20 : 40}>
          切换半径 (r={radius.value})
        </button>
        <span class="hint">点击无效 → SVG 永不更新</span>
      </div>
    </div>
  );
}

// ========================
// Bug C：根元素 tag 变化后 instance.el 游离
// diffElement 第 400 行 nodeName 不匹配 → replaceChild → instance.el 指向游离节点
// 表现：组件第二次更新时 parentNode 为 null 而静默跳过，组件死锁
// ========================
function BugC() {
  const mode = ref<'div' | 'section'>('div');
  const count = ref(0);

  return () => {
    const content = (
      <div class="bug-card">
        <div class="bug-header">
          <span class="bug-tag">Bug C</span>
          <span class="bug-severity mid">中</span>
        </div>
        <h3>根元素 Tag 变化后组件卡死</h3>
        <p class="bug-desc">
          <code>diffElement</code> 第 400 行 <code>nodeName</code> 不匹配时
          <code>replaceChild</code> 执行但 <code>instance.el</code> 未更新，
          下一次更新因 <code>parentNode === null</code> 而静默跳过。
        </p>
        <div class="bug-indicator">
          <p>当前根元素：<code>{mode.value}</code></p>
          <p>计数（每次更新 +1）：<strong>{count.value}</strong></p>
        </div>
        <div class="bug-actions">
          <button onClick={() => { mode.value = mode.value === 'div' ? 'section' : 'div' }}>
            🔄 切换根元素（div ↔ section）
          </button>
          <button onClick={() => count.value++}>
            +1 计数
          </button>
        </div>
        <div class="hint">操作顺序：点击切换 → 再点 +1 → 计数不更新说明组件已死锁</div>
      </div>
    );

    // 根据 mode 选择根元素类型
    if (mode.value === 'section') {
      return <section class="bug-card-outter">{content}</section>;
    }
    return <div class="bug-card-outter">{content}</div>;
  };
}

// ========================
// Bug D：patchComponentFragment 使用索引 diff，不支持 key
// 表现：Fragment 下的 key 列表在头部添加/删除时，input 状态错位
// ========================
function BugD() {
  const items = reactive([
    { id: 1, text: '条目 A' },
    { id: 2, text: '条目 B' },
    { id: 3, text: '条目 C' },
  ]);
  let nextId = 4;

  return () => (
    <>
      <div class="bug-card">
        <div class="bug-header">
          <span class="bug-tag">Bug D</span>
          <span class="bug-severity mid">中</span>
        </div>
        <h3>Fragment 子节点不支持 Keyed Diff</h3>
        <p class="bug-desc">
          <code>patchComponentFragment</code> 第 380 行使用索引 diff，
          Fragment 的直接子节点即使有 key 也不匹配。在 input 中输入内容，
          然后「头部插入」——input 状态会随着索引偏移。
        </p>
        <div class="bug-actions">
          <button onClick={() => items.unshift({ id: nextId++, text: `新条目 ${nextId - 1}` })}>
            头部插入
          </button>
          <button onClick={() => items.shift()}>
            头部删除
          </button>
          <button onClick={() => items.sort(() => Math.random() - 0.5)}>
            随机排序
          </button>
        </div>
      </div>
      {/* Fragment 的直接子节点：key 列表 — patchComponentFragment 对它们做索引 diff */}
      {items.map((item) => (
        <div class="fragment-row" key={item.id}>
          <span class="fragment-id">#{item.id}</span>
          <span>{item.text}</span>
          <input class="fragment-input" placeholder={`备注 ${item.id}`} />
          <button class="btn-del" onClick={() => {
            const idx = items.indexOf(item);
            if (idx >= 0) items.splice(idx, 1);
          }}>×</button>
        </div>
      ))}
    </>
  );
}

// ========================
// Bug E：value property 的更新 guard 可能阻止清空
// diffElement 第 438 行：hasValueAttr || newValue !== '' → newValue 为空且无 value attr 时不更新
// 表现：从有 value prop → 无 value prop 时残留旧输入内容
// ========================
function BugE() {
  const mode = ref<'controlled' | 'uncontrolled'>('controlled');
  const text = ref('初始文本');

  return () => (
    <div class="bug-card">
      <div class="bug-header">
        <span class="bug-tag">Bug E</span>
        <span class="bug-severity low">低</span>
      </div>
      <h3>Value Property 更新 Guard 异常</h3>
      <p class="bug-desc">
        <code>diffElement</code> 第 438 行当 <code>newValue === ''</code> 且
        无 <code>value</code> attribute 时不更新。演示：切为"无 value prop"
        后 input 残留旧值。
      </p>
      <div class="bug-demo">
        {mode.value === 'controlled' ? (
          <input class="bug-input" value={text.value} onInput={(e: any) => text.value = e.target.value} />
        ) : (
          <input class="bug-input" onInput={(e: any) => text.value = e.target.value} />
        )}
        <p class="bug-indicator">ref 值："{text.value}"</p>
      </div>
      <div class="bug-actions">
        <button onClick={() => text.value = '新文本'}>设为"新文本"</button>
        <button onClick={() => text.value = ''}>清空（ref = ""）</button>
        <button onClick={() => mode.value = mode.value === 'controlled' ? 'uncontrolled' : 'controlled'}>
          切换为{mode.value === 'controlled' ? '无' : '有'} value prop
        </button>
      </div>
      <div class="hint">在 input 中输入内容 → 清空按钮 → 再切换 mode → 观察残留</div>
    </div>
  );
}

// ========================
// 主页面
// ========================
export function Bugs() {
  return () => (
    <div class="bugs-container">
      <h1>已知 Bug 演示</h1>
      <p class="subtitle">以下演示当前 JSX 运行时的已知缺陷。每个 demo 展示一个具体 bug。</p>

      <BugB />
      <BugC />
      <BugD />
      <BugE />
    </div>
  );
}
