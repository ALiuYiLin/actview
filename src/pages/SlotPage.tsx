import { cardStyle, hintStyle } from "../styles";

// ============================================================
// ⑦ 插槽体系（默认 / 具名 / 作用域）
//   - 默认插槽：props.children
//   - 具名插槽：<template slot="name">（Babel 编译期转 slots prop）
//   - 作用域插槽：函数 children（render-prop）与具名作用域 <template slot="item" item>
// ============================================================

function Panel(props: any) {
  return (
    <div class="child-box"
      style={{ background: "#f1f5f9", borderRadius: "6px", padding: "12px 14px", marginTop: "10px" }}>
      <h4 style={{ margin: "0 0 6px", color: "#2563eb" }}>{props.slots?.title?.() ?? "（无标题插槽）"}</h4>
      <div>{props.children}</div>
      <div style={{ marginTop: "8px", color: "#64748b", fontSize: "12px" }}>
        {props.slots?.footer?.() ?? "（无 footer 插槽）"}
      </div>
    </div>
  );
}

function ItemList(props: any) {
  return (
    <ul class="list">
      {props.items.map((item: string, i: number) => (
        <li key={i}>{props.children?.({ item, i })}</li>
      ))}
    </ul>
  );
}

export function SlotPage() {
  return (
    <div class="demo-card" style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>⑦ 插槽体系</h2>
      <Panel>
        <template slot="title">具名插槽：标题</template>
        <template slot="footer">footer 插槽（template slot="footer"）</template>
        默认插槽内容 —— props.children 透传
      </Panel>
      <ItemList items={["Apple", "Banana", "Cherry"]}>
        {(scope: any) => (
          <b style={{ color: "#7c3aed" }}>{scope.i}: {scope.item}</b>
        )}
      </ItemList>
      <p style={hintStyle}>
        Panel：默认 + 具名插槽（template slot="title/footer"）；ItemList：作用域插槽（函数 children，子组件调用 children(scope) 传入作用域数据；具名作用域可用 template slot + 无值属性，但需 Babel 转换故在 src 中演示函数形式）
      </p>
    </div>
  );
}
