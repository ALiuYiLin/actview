import { reactive, onMounted, onUpdated, onBeforeUnmount } from "actview";
import { cardStyle, btnStyle, hintStyle } from "../styles";

// ============================================================
// ⑧ 生命周期钩子 + 模板引用（ref）
//   onMounted / onUpdated / onBeforeUnmount（子先父后，与 Vue 3 一致）
//   props.ref 挂载时指向 DOM，卸载时置 null
//
// 设计说明：
//   - 计数用【普通模块变量】——在生命周期钩子里读写「页面渲染依赖的响应式」
//     是反模式（`++` 的读会把响应式 track 进组件渲染 effect，写时自我触发循环）
//   - 页面刷新用 state.tick 渲染时钟：钩子/按钮里 tick++ 触发页面重渲染显示新计数；
//     tick 必须在【render 内容】里被读（见 hint 中的「渲染时钟 #n」），才能 track 进
//     页面渲染 effect —— 写在 setup 语句里不会生效，还会污染挂载上下文的依赖
// ============================================================

const state = reactive({ visible: true, n: 0, tick: 0 });
let mountedCount = 0;
let updatedCount = 0;
let unmountedCount = 0;
let inputEl: HTMLInputElement | null = null;

function Child() {
  onMounted(() => {
    mountedCount++;
    state.tick++;
  });
  onUpdated(() => {
    updatedCount++;
    state.tick++;
  });
  onBeforeUnmount(() => {
    unmountedCount++;
    state.tick++;
  });
  // 依赖 state.n：父级「触发更新」时本组件重渲染 → onUpdated
  return <span>Child({state.n})</span>;
}

export function LifecyclePage() {
  // 每次进入页面重置（普通变量 + 状态）
  mountedCount = updatedCount = unmountedCount = 0;
  state.visible = true;
  state.n = 0;
  state.tick++;

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
        <button style={btnStyle} onclick={() => { state.visible = !state.visible; state.tick++; }}>
          {state.visible ? "卸载 Child" : "挂载 Child"}
        </button>
        <button style={btnStyle} onclick={() => { state.n++; state.tick++; }}>触发 Child 更新</button>
      </div>
      <p style={hintStyle}>
        onMounted={mountedCount} 次　onUpdated={updatedCount} 次　onBeforeUnmount={unmountedCount} 次
        —— 挂载 / 更新 / 卸载分别触发（计数即时刷新）；Child 读 state.n，点「触发更新」会重渲染并触发 onUpdated；
        钩子执行期间暂停依赖收集（pauseTracking），钩子里改状态不会自我触发（对齐 Vue 3 post 队列语义）；
        每次进入页面计数重置（渲染时钟 #{state.tick}）
      </p>
    </div>
  );
}
