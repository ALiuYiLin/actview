import './slot.css'

function Card(_props?: any) {
  return (props: any) => (
    <div class="slot-card">
      {props.header && <div class="slot-card-header">{props.header}</div>}
      <div class="slot-card-body">{props.children}</div>
      {props.footer && <div class="slot-card-footer">{props.footer}</div>}
    </div>
  )
}

export function SlotDemo() {
  return () => (
    <div class="slot-demo-page">
      <h1>插槽 Slot</h1>
      <p class="subtitle">使用 <code>{'<template slot="xxx">'}</code> 传递命名插槽内容</p>

      <h3>基础 — 标题 + 内容 + 底部</h3>
      <Card>
        <template slot="header"><strong>卡片标题</strong></template>
        <p>这是卡片的主体内容。</p>
        <template slot="footer">
          <span class="slot-footer-text">底部信息</span>
        </template>
      </Card>

      <h3>仅默认插槽</h3>
      <Card>
        <p>没有 header 和 footer，只显示主体。</p>
      </Card>

      <h3>综合示例 — 用户卡片</h3>
      <Card>
        <template slot="header">
          <strong>用户名</strong>
          <span class="slot-user-tag">@actview</span>
        </template>
        <div class="slot-stats">
          <div><strong>42</strong><br /><span class="slot-stat-label">文章</span></div>
          <div><strong>128</strong><br /><span class="slot-stat-label">关注</span></div>
          <div><strong>256</strong><br /><span class="slot-stat-label">粉丝</span></div>
        </div>
        <template slot="footer">
          <button class="slot-follow-btn" onClick={() => alert('已关注！')}>+ 关注</button>
        </template>
      </Card>

      <h3>原理</h3>
      <div class="slot-desc">
        <p><code>{'<template slot="xxx">'}</code> 中的内容提取为 <code>props.xxx</code>。</p>
        <p>未包裹在 <code>template[slot]</code> 的子元素归入 <code>props.children</code>（默认插槽）。</p>
      </div>
    </div>
  )
}
