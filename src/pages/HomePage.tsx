import { RouterLink } from "@actview/router";
import { cardStyle } from "../styles";

// ============================================================
// 首页 — 全部路由清单（一行一个，与 router.ts 顺序一致）
// ============================================================

export function HomePage() {
  return (
    <div class="demo-card" style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>全部页面</h2>
      <ul style={{ lineHeight: 1.9, paddingLeft: 24, margin: 0 }}>
        <li><RouterLink to="/">/</RouterLink> — 首页（本页）</li>
        <li><RouterLink to="/reactive">/reactive</RouterLink> — ① 响应式更新</li>
        <li><RouterLink to="/list">/list</RouterLink> — ② keyed diff</li>
        <li><RouterLink to="/props">/props</RouterLink> — ③ props 细粒度更新</li>
        <li><RouterLink to="/toggle">/toggle</RouterLink> — ④ 条件渲染</li>
        <li><RouterLink to="/api">/api</RouterLink> — ⑤ 响应式 API</li>
        <li><RouterLink to="/array">/array</RouterLink> — ⑥ 数组方法</li>
        <li><RouterLink to="/slot">/slot</RouterLink> — ⑦ 插槽体系</li>
        <li><RouterLink to="/lifecycle">/lifecycle</RouterLink> — ⑧ 生命周期</li>
        <li><RouterLink to="/dynamic">/dynamic</RouterLink> — ⑨ 动态+keep-alive</li>
        <li><RouterLink to="/async">/async</RouterLink> — ⑩ 错误边界+Suspense</li>
        <li><RouterLink to="/icon">/icon</RouterLink> — ⑪ 图标</li>
        <li><RouterLink to="/fallthrough">/fallthrough</RouterLink> — ⑫ 透传/scoped</li>
        <li><RouterLink to="/provide">/provide</RouterLink> — ⑬ provide/inject</li>
        <li><RouterLink to="/test">/test</RouterLink> — 测试用空页面</li>
        <li><RouterLink to="/react-migration">/react-migration</RouterLink> — React hooks 迁移对照(索引)</li>
        <li><RouterLink to="/react-migration/use-state">/react-migration/use-state</RouterLink> — ① useState → ref</li>
        <li><RouterLink to="/react-migration/use-ref">/react-migration/use-ref</RouterLink> — ② useRef(DOM) → ref</li>
        <li><RouterLink to="/react-migration/use-effect">/react-migration/use-effect</RouterLink> — ③ useEffect → watch</li>
        <li><RouterLink to="/react-migration/use-memo">/react-migration/use-memo</RouterLink> — ④ useMemo → computed</li>
        <li><RouterLink to="/react-migration/use-callback">/react-migration/use-callback</RouterLink> — ⑤ useCallback → 普通函数</li>
        <li><RouterLink to="/react-migration/use-context">/react-migration/use-context</RouterLink> — ⑥ useContext → createContext</li>
        <li><RouterLink to="/react-migration/use-imperative-handle">/react-migration/use-imperative-handle</RouterLink> — ⑦ useImperativeHandle → 写入口 ref</li>
        <li><RouterLink to="/react-migration/use-id">/react-migration/use-id</RouterLink> — ⑧ useId → useId</li>
        <li><RouterLink to="/react-patterns">/react-patterns</RouterLink> — 无等价 hooks 的组合模式(索引)</li>
        <li><RouterLink to="/react-patterns/use-reducer">/react-patterns/use-reducer</RouterLink> — P1 useReducer → reactive + action</li>
        <li><RouterLink to="/react-patterns/use-layout-effect">/react-patterns/use-layout-effect</RouterLink> — P2 useLayoutEffect → watch post</li>
        <li><RouterLink to="/react-patterns/use-insertion-effect">/react-patterns/use-insertion-effect</RouterLink> — P3 useInsertionEffect → watch sync</li>
        <li><RouterLink to="/react-patterns/use-sync-external-store">/react-patterns/use-sync-external-store</RouterLink> — P4 订阅外部世界 + ref 桥接</li>
        <li><RouterLink to="/react-patterns/use-transition">/react-patterns/use-transition</RouterLink> — P5 pending + 错峰</li>
        <li><RouterLink to="/react-patterns/use-deferred-value">/react-patterns/use-deferred-value</RouterLink> — P6 延迟副本</li>
        <li><RouterLink to="/react-patterns/use-optimistic">/react-patterns/use-optimistic</RouterLink> — P7 乐观项回滚</li>
        <li><RouterLink to="/react-patterns/use-action-state">/react-patterns/use-action-state</RouterLink> — P8 pending + async action</li>
      </ul>
    </div>
  );
}
