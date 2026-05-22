// 插槽示例 — 使用 <template slot="xxx"> 传递命名插槽

/**
 * 一个使用插槽的卡片组件
 *
 * 接收:
 *   - props.header  → 命名插槽 "header"
 *   - props.footer  → 命名插槽 "footer"
 *   - props.children → 默认插槽（未指定 slot 的子元素）
 */
function Card() {
  return (props: any) => (
    <div class="slot-card">
      {props.header && (
        <div class="slot-card-header">{props.header}</div>
      )}
      <div class="slot-card-body">
        {props.children}
      </div>
      {props.footer && (
        <div class="slot-card-footer">{props.footer}</div>
      )}
    </div>
  )
}

export function SlotDemo() {
  return () => (
    <div class="slot-demo-page">
      <h1>插槽示例</h1>
      <p class="subtitle">使用 <code>{'<template slot="xxx">'}</code> 传递命名插槽内容</p>

      <h3>基础用法 — 标题 + 内容 + 底部</h3>
      <Card>
        <template slot="header">
          <span class="slot-icon">📌</span>
          <strong>卡片标题</strong>
        </template>

        <p>这是卡片的主体内容。</p>
        <p>可以放任意 DOM 元素。</p>

        <template slot="footer">
          <span style="color:#888;font-size:0.8rem;">底部信息：2026</span>
        </template>
      </Card>

      <h3>仅使用默认插槽</h3>
      <Card>
        <p>没有 header 和 footer，只显示主体内容。</p>
      </Card>

      <h3>综合示例 — 用户卡片</h3>
      <Card>
        <template slot="header">
          <img
            src="https://api.dicebear.com/7.x/avataaars/svg?seed=actview"
            style="width:40px;height:40px;border-radius:50%;vertical-align:middle;margin-right:8px;"
          />
          <strong>用户名</strong>
          <span style="color:#888;font-size:0.8rem;margin-left:8px;">@actview</span>
        </template>

        <div style="display:flex;gap:1rem;text-align:center;">
          <div><strong>42</strong><br /><span style="font-size:0.75rem;color:#888;">文章</span></div>
          <div><strong>128</strong><br /><span style="font-size:0.75rem;color:#888;">关注</span></div>
          <div><strong>256</strong><br /><span style="font-size:0.75rem;color:#888;">粉丝</span></div>
        </div>

        <template slot="footer">
          <button onClick={() => alert('已关注！')} style="width:100%;padding:6px;border:1px solid #646cff;border-radius:6px;background:#646cff22;color:#646cff;cursor:pointer;">
            + 关注
          </button>
        </template>
      </Card>

      <h3>原理说明</h3>
      <div class="slot-desc">
        <p><code>{'<template slot="xxx">'}</code> 中的内容会被提取为 <code>props.xxx</code>，组件内直接使用。</p>
        <p>未包裹在 <code>template[slot]</code> 中的子元素自动归入 <code>props.children</code>（默认插槽）。</p>
      </div>

      <style>{`
        .slot-demo-page { padding: 2rem; max-width: 600px; margin: 0 auto; }
        .slot-demo-page h1 { font-size: 1.8rem; margin-bottom: 0.3rem; }
        .slot-demo-page h3 { margin-top: 1.5rem; margin-bottom: 0.5rem; color: #ccc; }
        .subtitle { color: #888; font-size: 0.9rem; margin-bottom: 1rem; }
        .slot-card {
          border: 1px solid #333;
          border-radius: 10px;
          overflow: hidden;
          background: #1e1e2e;
          margin-bottom: 1rem;
        }
        .slot-card-header {
          padding: 0.75rem 1rem;
          background: #2a2a3e;
          border-bottom: 1px solid #333;
          font-size: 0.95rem;
        }
        .slot-card-body {
          padding: 1rem;
          color: #ccc;
          font-size: 0.9rem;
          line-height: 1.6;
        }
        .slot-card-footer {
          padding: 0.6rem 1rem;
          background: #2a2a3e;
          border-top: 1px solid #333;
        }
        .slot-icon { margin-right: 6px; }
        .slot-desc {
          background: #16162a;
          border: 1px solid #2a2a3e;
          border-radius: 8px;
          padding: 1rem;
          font-size: 0.85rem;
          line-height: 1.8;
          color: #aaa;
        }
        .slot-desc code {
          background: #2a2a3e;
          padding: 0.1rem 0.35rem;
          border-radius: 3px;
          color: #c9a0ff;
          font-size: 0.8rem;
        }
      `}</style>
    </div>
  )
}
