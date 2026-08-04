import { reactive } from "@local/core";
import { cardStyle, btnStyle, inputStyle, hintStyle, valueStyle } from "../styles";

// ============================================================
// ① 响应式更新（reactive + effect 自动 patch）
// ============================================================

export function ReactivePage() {
  const state = reactive({ count: 0 });
  return (
    <div class="demo-card" style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>① 响应式更新</h2>
      <p>
        count = <span class="value" style={valueStyle}>{state.count}</span>
      </p>
      <div>
        <button style={btnStyle} onclick={() => state.count--}>-1</button>
        <input style={inputStyle} value={state.count}
          oninput={(e) => (state.count = Number(e.target.value))} />
        <button style={btnStyle} onclick={() => state.count++}>+1</button>
      </div>
      <p style={hintStyle}>
        点击按钮或修改输入框 → reactive 状态变化 → 组件 effect 自动重跑 patch，文本与 value 同步更新
      </p>
    </div>
  );
}
