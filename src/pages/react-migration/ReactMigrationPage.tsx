// ============================================================
// React Hooks → ActView 等价写法 —— 父布局（嵌套路由）
//   /react-migration           → 本布局 + 索引子路由（速查表）
//   /react-migration/use-*     → 各 hook demo 子页（嵌套出口渲染）
//   核心差异:无 hooks 规则、无依赖数组(自动追踪)、setup 即返回 JSX 简写
// ============================================================

import { RouterLink, RouterView } from "@actview/router";
import { cardStyle, hintStyle } from "../../styles";

export function ReactMigrationPage() {
  return (
    <div style={{ padding: 20 }}>
      <h2>React Hooks → ActView 等价写法</h2>
      <p style={hintStyle}>
        核心差异:① 无 hooks 规则(不在组件函数里也能创建);② 无依赖数组(自动追踪);
        ③ setup 直接返回 JSX(简写,插件自动包装);④ ref/reactive 载体自带响应性。
        每个 hook 的对比 + 活 demo 在独立子页（本布局常驻，切换子页不重建）:
      </p>

      <div class="demo-card" style={cardStyle}>
        <ul style={{ lineHeight: 1.9, paddingLeft: 24, margin: 0 }}>
          <li><RouterLink to="/react-migration/use-state">① useState → ref</RouterLink></li>
          <li><RouterLink to="/react-migration/use-ref">② useRef(DOM) → ref</RouterLink></li>
          <li><RouterLink to="/react-migration/use-effect">③ useEffect → watch</RouterLink></li>
          <li><RouterLink to="/react-migration/use-memo">④ useMemo → computed</RouterLink></li>
          <li><RouterLink to="/react-migration/use-callback">⑤ useCallback → 普通函数</RouterLink></li>
          <li><RouterLink to="/react-migration/use-context">⑥ useContext → createContext</RouterLink></li>
          <li><RouterLink to="/react-migration/use-imperative-handle">⑦ useImperativeHandle → 写入口 ref</RouterLink></li>
          <li><RouterLink to="/react-migration/use-id">⑧ useId → useId</RouterLink></li>
          <li><RouterLink to="/react-migration">« 索引(速查表)</RouterLink></li>
        </ul>
      </div>

      {/* 嵌套路由出口:matched[1]（use-* 子页 / 索引速查表） */}
      <RouterView />
    </div>
  );
}

// ============================================================
// 索引子路由（path: ''）—— 其余 hooks 速查表
// ============================================================
export function ReactMigrationOverview() {
  return (
    <section style={{ ...cardStyle, marginBottom: 18 }}>
      <h3 style={{ margin: "0 0 6px" }}>其余 hooks 速查</h3>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
        <tr style={{ background: "#f1f5f9" }}><th style={{ padding: 6, textAlign: "left" }}>React</th><th style={{ padding: 6, textAlign: "left" }}>ActView</th></tr>
        <tr><td style={{ padding: 6 }}>useLayoutEffect</td><td style={{ padding: 6 }}>watch(source, cb, flush: 'post') + onMounted</td></tr>
        <tr><td style={{ padding: 6 }}>useReducer</td><td style={{ padding: 6 }}>reactive(状态对象) + 普通函数(action)</td></tr>
        <tr><td style={{ padding: 6 }}>useSyncExternalStore</td><td style={{ padding: 6 }}>watch(外部源) + 手动桥接(或未来内置)</td></tr>
        <tr><td style={{ padding: 6 }}>useTransition / useDeferredValue</td><td style={{ padding: 6 }}>并发渲染未实现——暂无等价物</td></tr>
        <tr><td style={{ padding: 6 }}>useOptimistic / useActionState</td><td style={{ padding: 6 }}>暂无等价物(组合 ref + watch 可近似)</td></tr>
      </table>
    </section>
  );
}
