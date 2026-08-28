// ============================================================
// react-migration 共享:双栏代码对比 Section
// （子路由页渲染在父布局的嵌套 <RouterView/> 出口内，无独立外壳）
// ============================================================
import { cardStyle, hintStyle } from "../../styles";

export const codeStyle: any = {
  background: "#0f172a",
  color: "#e2e8f0",
  padding: 10,
  borderRadius: 6,
  fontSize: 12,
  margin: 0,
  flex: 1,
  minWidth: 280,
  whiteSpace: "pre-wrap",
};

export function Section(props: { title: string; note?: string; reactCode: string; actviewCode: string; children?: any }) {
  return (
    <section style={{ ...cardStyle, marginBottom: 18 }}>
      <h3 style={{ margin: "0 0 6px" }}>{props.title}</h3>
      {props.note && <p style={{ ...hintStyle, marginTop: 0 }}>{props.note}</p>}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <pre style={codeStyle}>{props.reactCode}</pre>
        <pre style={codeStyle}>{props.actviewCode}</pre>
      </div>
      <div style={{ padding: 10, background: "#f8fafc", borderRadius: 8 }}>{props.children}</div>
    </section>
  );
}
