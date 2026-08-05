import { reactive, ref, KeepAlive } from "actview";
import { cardStyle, btnStyle, hintStyle } from "../styles";

// ============================================================
// ⑨ 动态组件 + keep-alive（标签页切换，状态保留）
//   <component is={...}> 动态解析；KeepAlive 缓存实例与 DOM，切换不重建
// ============================================================

function TabA() {
  const n = ref(0);
  return (
    <div class="child-box" style={{ background: "#ecfdf5", borderRadius: "6px", padding: "12px 14px" }}>
      标签页 A —— 本地计数 <b>{n.value}</b>
      <button style={btnStyle} onclick={() => n.value++}>A 自增（切走再切回，计数保留）</button>
    </div>
  );
}

function TabB() {
  return <div class="child-box" style={{ background: "#eff6ff", borderRadius: "6px", padding: "12px 14px" }}>标签页 B —— 普通内容</div>;
}

function TabC() {
  return <div class="child-box" style={{ background: "#fdf4ff", borderRadius: "6px", padding: "12px 14px" }}>标签页 C —— 普通内容</div>;
}

export function DynamicPage() {
  const state = reactive({ tab: "a" });

  return (
    <div class="demo-card" style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>⑨ 动态组件 + keep-alive</h2>
      <div>
        {["a", "b", "c"].map((t) => (
          <button
            key={t}
            style={{
              ...btnStyle,
              background: state.tab === t ? "#2563eb" : "#e2e8f0",
              color: state.tab === t ? "#fff" : "#334155",
            }}
            onclick={() => (state.tab = t)}
          >
            标签 {t.toUpperCase()}
          </button>
        ))}
      </div>
      <div style={{ marginTop: "12px" }}>
        <KeepAlive>
          <component is={state.tab === "a" ? TabA : state.tab === "b" ? TabB : TabC} />
        </KeepAlive>
      </div>
      <p style={hintStyle}>
        {'<component is>'} 按 props.is 动态解析组件；KeepAlive 缓存实例与 DOM —— 在 A 里自增后切走再切回，计数与 DOM 均保留（onMounted 只触发一次）
      </p>
    </div>
  );
}
