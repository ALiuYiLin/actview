import { defineAsyncComponent, defineComponent, onErrorCaptured, reactive, ref, Suspense } from "actview";
import { cardStyle, btnStyle, hintStyle } from "../styles";

// ============================================================
// ⑩ 错误边界 + Suspense / 异步组件（v2：vue 语义）
//   ErrorBoundary：子树渲染抛错 → 显示 fallback（基于 onErrorCaptured）
//   Suspense + defineAsyncComponent：异步加载组件，加载中显示 fallback
// ============================================================

const boom = reactive({ on: false });

function throwBoom() {
  throw new Error("boom!");
}

function Bomber() {
  // 抛错放在 JSX 表达式内（render 期执行、被渲染 effect 跟踪）
  return <span>{boom.on ? throwBoom() : "✅ 正常渲染"}</span>;
}

// v2 错误边界组件：onErrorCaptured 捕获子树错误（vue 语义）
function ErrorBoundary(props: { fallback: any; children?: any }) {
  const hasError = ref(false)
  onErrorCaptured(() => {
    hasError.value = true
    return false // 阻止继续冒泡
  })
  return () => (hasError.value ? props.fallback : props.children)
}

// 模拟异步加载：1 秒后 resolve 一个组件（vue defineAsyncComponent）
// 返回类型断言（ActViewComponent 自定义形状与 vue 的 DefineAsyncComponent 不完全同构）
const AsyncCard = defineAsyncComponent(
  () =>
    new Promise((resolve) =>
      setTimeout(
        () =>
          resolve({
            // ActViewComponent 是类型层自定义形状（无构造签名），
            // 断言回 vue Component 兼容 defineAsyncComponent loader 类型
            default: defineComponent(function Loaded() {
              return () => <div class="child-box" style={{ background: "#fef3c7", borderRadius: "6px", padding: "12px 14px" }}>异步组件加载完成 🎉</div>;
            }),
          } as any),
        1000,
      ),
    ),
) as any;

export function AsyncPage() {
  return (
    <div class="demo-card" style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>⑩ 错误边界 + Suspense / 异步组件</h2>

      <div style={{ marginBottom: "16px" }}>
        <button style={btnStyle} onclick={() => (boom.on = !boom.on)}>
          {boom.on ? "复位 Bomber" : "触发渲染错误"}
        </button>
        <ErrorBoundary fallback={<b style={{ color: "#dc2626" }}>⚠️ 组件渲染出错（ErrorBoundary fallback）</b>}>
          <Bomber />
        </ErrorBoundary>
      </div>

      <Suspense v-slots={{ fallback: () => <span style={{ color: "#94a3b8" }}>⏳ 异步组件加载中…</span> }}>
        <AsyncCard />
      </Suspense>

      <p style={hintStyle}>
        点击「触发渲染错误」→ Bomber 抛错被 ErrorBoundary 捕获显示 fallback；
        AsyncCard 经 defineAsyncComponent 异步加载（1s），加载期间 Suspense 显示 fallback，完成后渲染真实组件
      </p>
    </div>
  );
}
