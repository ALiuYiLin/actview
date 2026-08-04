import { reactive } from "actview";
import { cardStyle, btnStyle, hintStyle } from "../styles";

// ============================================================
// ④ 条件渲染（type 变化 → 整体替换）
// ============================================================

export function TogglePage() {
  const state = reactive({ show: true });
  return (
    <div class="demo-card" style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>④ 条件渲染（type 变化 → 整体替换）</h2>
      <button style={btnStyle} onclick={() => (state.show = !state.show)}>
        点击{state.show ? "隐藏" : "显示"}
      </button>
      {state.show
        ? <p class="panel on" style={{ color: "#16a34a" }}>✅ 当前可见（show = true）</p>
        : <p class="panel off" style={{ color: "#dc2626" }}>🚫 已隐藏（show = false）</p>}
      <p style={hintStyle}>条件分支 type 不同 → patch 走整体替换路径</p>
    </div>
  );
}
