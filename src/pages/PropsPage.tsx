import { reactive } from "@local/core";
import { cardStyle, inputStyle, hintStyle } from "../styles";

// ============================================================
// ③ props 细粒度更新（父传子，不重挂，setup 只执行一次）
// ============================================================

let greetSetupCount = 0;

function Greet(props: { name: string }) {
  greetSetupCount++;
  return (
    <div class="child-box"
      style={{ background: "#f1f5f9", borderRadius: "6px", padding: "10px 14px", marginTop: "10px" }}>
      <span>props.name = </span>
      <strong style={{ color: "#2563eb" }}>{props.name}</strong>
      <span style={{ marginLeft: "12px", color: "#64748b", fontSize: "12px" }}>
        setup 已执行 <b>{greetSetupCount}</b> 次
      </span>
    </div>
  );
}

export function PropsPage() {
  const state = reactive({ name: "actview" });
  return (
    <div class="demo-card" style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>③ props 细粒度更新（不重挂）</h2>
      <input style={inputStyle} value={state.name}
        oninput={(e) => (state.name = e.target.value)} />
      <Greet name={state.name} />
      <p style={hintStyle}>
        修改输入框 → 子组件只精确更新文本；setup 次数不变说明组件实例与 DOM 被复用而非重建
      </p>
    </div>
  );
}
