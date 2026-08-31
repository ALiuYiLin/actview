// ============================================================
// 无内置等价 hooks 的组合写法 —— 父布局（嵌套路由）
//   /react-patterns/use-*      → 各模式 demo 子页（嵌套出口渲染）
//
// React 并发/副作用类 hooks 在 ActView 没有内置等价物,
// 但全部可以用原生原语【内联组合】表达(不定义 hooks 包装函数)。
// ============================================================

import { RouterLink, RouterView } from "vue-router";
import { cardStyle, hintStyle } from "../../styles";

export function PatternsPage() {
  return (
    <div style={{ padding: 20 }}>
      <h2>无内置等价 hooks 的组合写法</h2>
      <p style={hintStyle}>
        React 并发/副作用类 hooks 在 ActView 没有内置等价物——但全部可用原生原语
        <b>内联组合</b>(不定义 hooks 包装函数):reactive 状态 + action 对象、
        computed 派生、watch 三种 flush、ref 桥接外部订阅、乐观项回滚。
        唯一无法组合的是<b>时间切片</b>(同步渲染管线,无优先级调度)——已诚实降级。
        每个模式的对比 + 活 demo 在独立子页（本布局常驻，切换子页不重建）:
      </p>

      <div class="demo-card" style={cardStyle}>
        <ul style={{ lineHeight: 1.9, paddingLeft: 24, margin: 0 }}>
          <li><RouterLink to="/react-patterns/use-reducer">P1 useReducer → reactive 状态 + action 对象</RouterLink></li>
          <li><RouterLink to="/react-patterns/use-layout-effect">P2 useLayoutEffect → watch flush:'post'</RouterLink></li>
          <li><RouterLink to="/react-patterns/use-insertion-effect">P3 useInsertionEffect → watch flush:'sync'</RouterLink></li>
          <li><RouterLink to="/react-patterns/use-sync-external-store">P4 useSyncExternalStore → 订阅 + ref 桥接</RouterLink></li>
          <li><RouterLink to="/react-patterns/use-transition">P5 useTransition → pending + 错峰</RouterLink></li>
          <li><RouterLink to="/react-patterns/use-deferred-value">P6 useDeferredValue → 延迟副本</RouterLink></li>
          <li><RouterLink to="/react-patterns/use-optimistic">P7 useOptimistic → 乐观项回滚</RouterLink></li>
          <li><RouterLink to="/react-patterns/use-action-state">P8 useActionState → pending + async action</RouterLink></li>
        </ul>
      </div>

      {/* 嵌套路由出口:matched[1]（use-* 子页） */}
      <RouterView />
    </div>
  );
}
