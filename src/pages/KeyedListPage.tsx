import { reactive } from "@local/core";
import { cardStyle, btnStyle, hintStyle } from "../styles";

// ============================================================
// ② keyed diff（列表按 key 复用 / 增删 / 重排）
// ============================================================

export function KeyedListPage() {
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
