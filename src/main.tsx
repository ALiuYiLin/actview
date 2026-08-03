import { createApp, reactive } from "@local/core";

// ============================================================
// actview 响应式前端框架 — 功能检验页
//   ① 响应式更新（reactive + effect 自动 patch）
//   ② keyed diff（列表按 key 复用 / 增删 / 重排）
//   ③ props 细粒度更新（父传子，不重挂，setup 只执行一次）
//   ④ 条件渲染（type 变化 → 整体替换）
// ============================================================

const cardStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "16px 20px",
  marginBottom: "16px",
  background: "#ffffff",
};

const btnStyle = {
  padding: "6px 14px",
  marginRight: "8px",
  border: "1px solid #cbd5e1",
  borderRadius: "6px",
  background: "#f8fafc",
  cursor: "pointer",
};

const inputStyle = {
  padding: "6px 10px",
  border: "1px solid #cbd5e1",
  borderRadius: "6px",
  marginRight: "8px",
};

const hintStyle = { color: "#64748b", fontSize: "12px", marginTop: "10px" };
const valueStyle = { color: "#dc2626", fontWeight: 700, fontSize: "20px" };

// ---------- ① 响应式更新 ----------
function Counter() {
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

// ---------- ② keyed diff ----------
function KeyedList() {
  const state = reactive({ items: ["Apple", "Banana", "Cherry"], seq: 3 });
  return (
    <div class="demo-card" style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>② keyed diff（列表复用 / 增删 / 重排）</h2>
      <ul class="list">
        {state.items.map((item) => <li key={item}>{item}</li>)}
      </ul>
      <div>
        <button style={btnStyle}
          onclick={() => (state.items = [...state.items, "Item-" + state.seq++])}>新增</button>
        <button style={btnStyle}
          onclick={() => (state.items = state.items.slice(1))}>删除首个</button>
        <button style={btnStyle}
          onclick={() => (state.items = [...state.items].reverse())}>反转</button>
        <button style={btnStyle}
          onclick={() => (state.items = ["Apple", "Banana", "Cherry"])}>重置</button>
      </div>
      <p style={hintStyle}>
        列表按 key 匹配复用 DOM：反转 / 增删只移动或新建必要节点，其余原样保留
      </p>
    </div>
  );
}

// ---------- ③ props 细粒度更新 ----------
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

function PropsDemo() {
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

// ---------- ④ 条件渲染 ----------
function Toggle() {
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

// ---------- 页面根组件 ----------
function App() {
  return (
    <div class="app"
      style={{ fontFamily: "system-ui, -apple-system, sans-serif", maxWidth: "720px", margin: "0 auto", padding: "24px 16px", background: "#f8fafc", minHeight: "100vh" }}>
      <h1 style={{ fontSize: "24px", marginBottom: "20px" }}>
        actview — 响应式前端框架检验页
      </h1>
      <Counter />
      <KeyedList />
      <PropsDemo />
      <Toggle />
      <p style={{ color: "#94a3b8", fontSize: "12px", textAlign: "center" }}>
        本页面由 actview 自身渲染：自研 JSX runtime + Babel 编译插件 + 响应式系统
      </p>
    </div>
  );
}

createApp(App).mount("#app");
