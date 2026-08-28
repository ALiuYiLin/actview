// ============================================================
// React Hooks → ActView 等价写法 迁移演示页
//   路由:/react-migration
//   每节 = React 写法 vs ActView 写法(代码对比)+ 可交互活 demo
//   核心差异:无 hooks 规则、无依赖数组(自动追踪)、setup 即返回 JSX 简写
// ============================================================

import {
  computed,
  createContext,
  rawRef,
  reactive,
  ref,
  toRefs,
  useId,
  watch,
} from "actview";
import { cardStyle, btnStyle, hintStyle, inputStyle } from "../../styles";

// ============================================================
// ① useState → ref
// ============================================================
function DemoState() {
  // React: const [count, setCount] = useState(0)
  const count = ref(0);
  return (
    <div>
      <span style={hintStyle}>count = {count.value}</span>
      <button style={btnStyle} onclick={() => count.value++}>+1</button>
    </div>
  );
}

// ============================================================
// ② useRef(DOM) → ref + 挂载后自动写入
// ============================================================
function DemoRefDom() {
  const inputEl = ref<HTMLInputElement | null>(null);
  const focus = () => inputEl.value?.focus();
  return (
    <div>
      <input ref={inputEl} style={inputStyle} placeholder="被聚焦的输入框" />
      <button style={btnStyle} onclick={focus}>聚焦(focus)</button>
    </div>
  );
}

// ============================================================
// ③ useEffect → watch(无依赖数组;返回停止函数 = cleanup)
// ============================================================
function DemoEffect() {
  const keyword = ref("");
  const logs = ref<string[]>([]);
  let seq = 0;
  // React: useEffect(() => { console.log(keyword); }, [keyword])
  // ActView: watch(source, cb) —— 依赖自动追踪;返回停止函数(cleanup)
  const stop = watch(keyword, (v) => {
    logs.value = [...logs.value, `#${++seq} 检索:${v || "(空)"}`];
  });
  const clear = () => {
    stop(); // 等价 effect cleanup / 卸载自动清理
    logs.value = [];
  };
  return (
    <div>
      <input style={inputStyle} value={keyword.value} oninput={(e: any) => (keyword.value = e.target.value)} placeholder="输入触发 watch" />
      <button style={btnStyle} onclick={clear}>停止 watch 并清空</button>
      <ul style={{ fontSize: 12, color: "#475569" }}>
        {logs.value.map((l) => <li>{l}</li>)}
      </ul>
    </div>
  );
}

// ============================================================
// ④ useMemo → computed(依赖自动追踪,无依赖数组)
// ============================================================
function DemoMemo() {
  const items = ref([1, 2, 3, 4, 5, 6]);
  const threshold = ref(3);
  // React: const big = useMemo(() => items.filter(i => i >= threshold), [items, threshold])
  const big = computed(() => items.value.filter((i) => i >= threshold.value));
  const addItem = () => (items.value = [...items.value, items.value.length + 1]);
  return (
    <div>
      <span style={hintStyle}>≥ 阈值 {threshold.value} 的项:{big.value.join(", ") || "(无)"}</span>
      <button style={btnStyle} onclick={() => (threshold.value = threshold.value - 1)}>阈值-1</button>
      <button style={btnStyle} onclick={addItem}>加一项</button>
    </div>
  );
}

// ============================================================
// ⑤ useCallback → 普通函数(ActView 追踪「读取的响应式数据」,
//    而非函数身份——无需缓存,闭包每次重建不影响订阅)
// ============================================================
function DemoCallback() {
  const n = ref(10);
  // React: const add = useCallback(() => setN(n + 1), [n]) —— 需要 deps
  // ActView: 普通箭头函数即可,子组件永远不会因「函数身份变化」而重渲染
  const makeAdder = (delta: number) => () => (n.value += delta);
  return (
    <div>
      <span style={hintStyle}>n = {n.value}</span>
      <button style={btnStyle} onclick={makeAdder(5)}>+5</button>
      <button style={btnStyle} onclick={makeAdder(-3)}>-3</button>
    </div>
  );
}

// ============================================================
// ⑥ useContext → createContext().Provider + .use()
// ============================================================
const SizeCtx = createContext<{ size: string; setSize: (s: string) => void } | undefined>(undefined);

function SizeLabel() {
  const s = SizeCtx.use()!;
  return <span style={hintStyle}>当前字号:{s.size}</span>;
}

function SizeButton() {
  const s = SizeCtx.use()!;
  const next = s.size === "大" ? "小" : "大";
  return <button style={btnStyle} onclick={() => s.setSize(next)}>切换为{next}字</button>;
}

function DemoContext() {
  const ctx = reactive({ size: "大", setSize(next: string) { this.size = next; } });
  return (
    <SizeCtx.Provider value={ctx}>
      <div>
        <SizeLabel />
        <SizeButton />
        <p style={{ fontSize: ctx.size === "大" ? 20 : 13, margin: 0 }}>
          这段文字的字号来自 context(ctx.size)
        </p>
      </div>
    </SizeCtx.Provider>
  );
}

// ============================================================
// ⑦ useImperativeHandle → 统一写入口 ref(子把 { 方法 } 挂到父传入的 ref)
// ============================================================
function DemoImperative() {
  const text = ref("可重置的内容");
  const actionsRef = ref<{ reset(): void } | null>(null);
  return (
    <div>
      {/* ⚠️ ref 值形态的 prop 须经 rawRef 直传（顶层解包陷阱） */}
      <ActionChild actionsRef={rawRef(actionsRef)} text={text.value} />
      <span style={hintStyle}>当前:{text.value}</span>
      <button style={btnStyle} onclick={() => actionsRef.value?.reset()}>
        调用子组件 reset()
      </button>
    </div>
  );
}

function ActionChild(props: { actionsRef: any; text: string }) {
  const { actionsRef, text } = toRefs(props);
  // 子部件侧:把命令式 API 写进父传入的 ref(等价 useImperativeHandle)
  actionsRef.value = {
    reset: () => { text.value = "已由父调用 reset 重置"; },
  };
  return <span style={hintStyle}>(子部件暴露 reset 给父)</span>;
}

// ============================================================
// ⑧ useId → useId(同名等价)
// ============================================================
function DemoUseId() {
  const id = useId();
  return <input style={inputStyle} id={id} placeholder={`useId → ${id}`} />;
}

// ============================================================
// 页面组装
// ============================================================
function Section(props: { title: string; reactCode: string; actviewCode: string; children?: any }) {
  return (
    <section style={{ ...cardStyle, marginBottom: 18 }}>
      <h3 style={{ margin: "0 0 6px" }}>{props.title}</h3>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <pre style={codeStyle}>{props.reactCode}</pre>
        <pre style={codeStyle}>{props.actviewCode}</pre>
      </div>
      <div style={{ padding: 10, background: "#f8fafc", borderRadius: 8 }}>{props.children}</div>
    </section>
  );
}

const codeStyle: any = {
  background: "#0f172a", color: "#e2e8f0", padding: 10, borderRadius: 6,
  fontSize: 12, margin: 0, flex: 1, minWidth: 280, whiteSpace: "pre-wrap",
};

export function ReactMigrationPage() {
  return (
    <div style={{ padding: 20 }}>
      <h2>React Hooks → ActView 等价写法</h2>
      <p style={hintStyle}>
        核心差异:① 无 hooks 规则(不在组件函数里也能创建);② 无依赖数组(自动追踪);
        ③ setup 直接返回 JSX(简写,插件自动包装);④ ref/reactive 载体自带响应性。
      </p>

      <Section title="① useState → ref" reactCode={"const [n, setN] = useState(0);\nsetN(n + 1);"} actviewCode={"const n = ref(0);\nn.value += 1;"}>
        <DemoState />
      </Section>

      <Section title="② useRef(DOM) → ref" reactCode={"const el = useRef(null);\n<input ref={el} />"} actviewCode={"const el = ref(null);\n<input ref={el} />"}>
        <DemoRefDom />
      </Section>

      <Section title="③ useEffect → watch(无依赖数组;返回停止函数 = cleanup)" reactCode={"useEffect(() => {\n  log(keyword);\n}, [keyword]);"} actviewCode={"watch(keyword, (v) => {\n  log(v);\n}); // 返回 stop()"} >
        <DemoEffect />
      </Section>

      <Section title="④ useMemo → computed(依赖自动追踪)" reactCode={"const big = useMemo(\n  () => items.filter(i => i >= t),\n  [items, t]\n);"} actviewCode={"const big = computed(\n  () => items.value.filter(i => i >= t.value)\n);"}>
        <DemoMemo />
      </Section>

      <Section title="⑤ useCallback → 普通函数(无需缓存)" reactCode={"const add = useCallback(\n  () => setN(n + 1),\n  [n]\n);"} actviewCode={"const add = () => (n.value += 1);"}>
        <DemoCallback />
      </Section>

      <Section title="⑥ useContext → createContext" reactCode={"const SizeCtx = createContext();\nconst s = useContext(SizeCtx);"} actviewCode={"const SizeCtx = createContext(…);\nconst s = SizeCtx.use().value;"}>
        <DemoContext />
      </Section>

      <Section title="⑦ useImperativeHandle → 统一写入口 ref" reactCode={"useImperativeHandle(ref, () => ({\n  reset: () => …\n}));"} actviewCode={"// 子组件:把 API 写进父传入的 ref\nref.value = { reset: () => … };"}>
        <DemoImperative />
      </Section>

      <Section title="⑧ useId → useId(同名等价)" reactCode={"const id = useId();"} actviewCode={"const id = useId();"}>
        <DemoUseId />
      </Section>

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
    </div>
  );
}
