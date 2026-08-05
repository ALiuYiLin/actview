import { reactive, ref, computed, watch, toRefs, readonly, markRaw } from "actview";
import { cardStyle, btnStyle, hintStyle, valueStyle } from "../styles";

// ============================================================
// ⑤ 响应式 API 全家桶（ref / computed / watch / toRefs / readonly / markRaw / 批处理）
//   组件函数体是 setup（执行一次）；渲染计数用 JSX 表达式在 render 期累加
// ============================================================

let renderCount = 0;
const rawObj = { untouched: true };
markRaw(rawObj);

export function ApiPage() {
  // ref
  const count = ref(0);
  // reactive + toRefs 解构
  const state = reactive({ base: 10, factor: 2 });
  const { base } = toRefs(state);
  // computed 派生
  const total = computed(() => base.value * state.factor + count.value);
  // watch 侦听（组件内创建 → 组件卸载自动停止，EffectScope）
  const watchLog: string[] = [];
  watch(count, (v) => watchLog.push(String(v)));
  // readonly
  const locked = readonly({ secret: 42 });

  return (
    <div class="demo-card" style={cardStyle}>
      {(() => { renderCount++; return ""; })()}
      <h2 style={{ marginTop: 0 }}>⑤ 响应式 API 全家桶</h2>
      <p>
        count(ref) = <span style={valueStyle}>{count.value}</span>
        <button style={btnStyle} onclick={() => count.value++}>ref+1</button>
      </p>
      <p>
        total = base×factor + count = <strong style={{ color: "#7c3aed" }}>{total.value}</strong>
        <button style={btnStyle} onclick={() => state.factor++}>factor+1</button>
      </p>
      <p>
        toRefs 解构 base = <span style={valueStyle}>{base.value}</span>
        <button style={btnStyle} onclick={() => state.base += 5}>base+5</button>
      </p>
      <p style={hintStyle}>
        watch 记录：{watchLog.length ? watchLog.join(" → ") : "（点击 count+1 触发）"}
      </p>
      <p style={hintStyle}>
        readonly.secret = {locked.secret}（赋值会 console.warn）　|　
        markRaw 跳过代理：reactive(rawObj) === rawObj = {String(reactive(rawObj) === rawObj)}
      </p>
      <p style={hintStyle}>
        调度批处理：本页累计渲染 <b>{renderCount}</b> 次 —— 连续点 3 次 ref+1，渲染只 +1 次
      </p>
    </div>
  );
}
