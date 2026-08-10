import { ref } from "actview";
import { cardStyle, btnStyle, hintStyle } from "../styles";

// ============================================================
// ⑬ provide / inject（ctx.provide + ctx.injects）
//   - 祖先 provide 键值，任意后代经 ctx.injects 读取，中间组件无需透传
//   - 未 provide 的组件共享父注入表（零拷贝）；同名 key 覆盖继承值
//   - 提供 ref 保持响应式（count 变化联动更新）
// ============================================================

function ThemeProvider(_props: any, ctx?: any) {
  ctx.provide("theme", "dark");
  const count = ref(0);
  ctx.provide("count", count);
  return <ThemeMid />;
}

// 未使用 provide：纯转发中间层（共享父注入表，零拷贝）
function ThemeMid() {
  return (
    <div style={{ marginTop: "10px" }}>
      <ThemeButton />
      <Counter />
      <ThemeOverride />
    </div>
  );
}

// 深层消费方：直接读 ctx.injects（主题）
function ThemeButton(_props: any, ctx?: any) {
  const dark = ctx.injects.theme === "dark";
  return (
    <button
      style={{
        ...btnStyle,
        background: dark ? "#1e293b" : "#ffffff",
        color: dark ? "#f8fafc" : "#0f172a",
      }}
    >
      主题按钮（{ctx.injects.theme}）
    </button>
  );
}

// 响应式注入：读取 provide 的 ref，点击 +1 联动更新
function Counter(_props: any, ctx?: any) {
  return (
    <span style={{ display: "inline-block" }}>
      <button style={btnStyle} onclick={() => ctx.injects.count.value++}>
        count +1
      </button>
      <b style={{ color: "#dc2626" }}>{ctx.injects.count.value}</b>
    </span>
  );
}

// 覆盖继承值：同名 provide 在自身子树内生效，不污染祖先表
function ThemeOverride(_props: any, ctx?: any) {
  ctx.provide("theme", "light");
  return <ThemeButton />;
}

export function ProvidePage() {
  return (
    <div class="demo-card" style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>⑬ provide / inject（依赖注入）</h2>
      <ThemeProvider />
      <p style={hintStyle}>
        ThemeProvider provide("theme", "dark") + provide("count", ref)——ThemeMid 不 provide（共享父注入表，
        零拷贝）；ThemeButton / Counter 任意层级直接 ctx.injects 读取；ThemeOverride 同名覆盖为 light
        （copy-on-write 隔离，祖先表不变）；count 为 ref 注入，点击 +1 联动更新
      </p>
    </div>
  );
}
