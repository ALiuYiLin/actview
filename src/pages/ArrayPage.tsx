import { reactive } from "actview";
import { cardStyle, btnStyle, hintStyle } from "../styles";

// ============================================================
// ⑥ 数组方法（直接调用 push/pop/shift/unshift/splice/sort/reverse + for...in）
// ============================================================

export function ArrayPage() {
  const state = reactive({ items: [1, 2, 3], seq: 4 });
  const iterCount = () => Object.keys(state.items).length;

  return (
    <div class="demo-card" style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>⑥ 数组方法（直接调用即响应）</h2>
      <ul class="list">
        {state.items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
      <div>
        <button style={btnStyle} onclick={() => state.items.push(state.seq++)}>push</button>
        <button style={btnStyle} onclick={() => state.items.pop()}>pop</button>
        <button style={btnStyle} onclick={() => state.items.shift()}>shift</button>
        <button style={btnStyle} onclick={() => state.items.unshift(state.seq++)}>unshift</button>
        <button style={btnStyle} onclick={() => state.items.splice(1, 1)}>splice(1,1)</button>
        <button style={btnStyle} onclick={() => state.items.sort((a, b) => a - b)}>sort</button>
        <button style={btnStyle} onclick={() => state.items.reverse()}>reverse</button>
      </div>
      <p style={hintStyle}>
        数组修改方法经 instrumentation 触发更新（length / 索引 / 父级依赖）；
        for...in 计数 = <b>{iterCount()}</b>（增删元素会触发迭代依赖）
      </p>
    </div>
  );
}
