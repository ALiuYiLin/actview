import { reactive, onMounted, onUpdated, onBeforeUnmount } from "actview";
import { cardStyle, btnStyle, hintStyle } from "../styles";

// ============================================================
// ⑧ 生命周期钩子 + 模板引用（ref）
//   onMounted / onUpdated / onBeforeUnmount（子先父后，与 Vue 3 一致）
//   props.ref 挂载时指向 DOM，卸载时置 null
// ============================================================

let mountedCount = 0;
let updatedCount = 0;
let unmountCount = 0;
let inputEl: HTMLInputElement | null = null;

function Child() {
  onMounted(() => mountedCount++);
  onUpdated(() => updatedCount++);
  onBeforeUnmount(() => unmountCount++);
  return <span>Child</span>;
}

export function LifecyclePage() {
  const state = reactive({ visible: true, n: 0 });

  return (
    <div class="demo-card" style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>⑧ 生命周期 + 模板引用</h2>
      <input
        style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", marginRight: "10px" }}
        ref={(el: HTMLInputElement | null) => (inputEl = el)}
        value="ref 指向此输入框"
        readOnly
      />
      <span style={{ color: "#64748b", fontSize: "12px" }}>
        ref 指向的 DOM：{inputEl ? `tagName=${inputEl.tagName}` : "（未挂载）"}
      </span>
      <div style={{ marginTop: "12px" }}>
        {state.visible ? <Child /> : <span style={{ color: "#94a3b8" }}>（Child 已卸载）</span>}
      </div>
      <div style={{ marginTop: "8px" }}>
        <button style={btnStyle} onclick={() => state.visible = !state.visible}>
          {state.visible ? "卸载 Child" : "挂载 Child"}
        </button>
        <button style={btnStyle} onclick={() => state.n++}>触发 Child 更新</button>
      </div>
      <p style={hintStyle}>
        onMounted={mountedCount} 次　onUpdated={updatedCount} 次　onBeforeUnmount={unmountCount} 次
        —— 挂载/卸载/更新分别触发；组件内 watch 等 effect 随卸载自动停止（EffectScope）
      </p>
    </div>
  );
}
