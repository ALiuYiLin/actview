// ============================================================
// 无内置等价 hooks 的组合写法 —— 每个 hook 一个独立路由页面
//   /react-patterns/use-reducer | use-layout-effect | use-insertion-effect
//   /react-patterns/use-sync-external-store | use-transition | use-deferred-value
//   /react-patterns/use-optimistic | use-action-state
// ============================================================

import { computed, onUnmounted, reactive, ref, watch } from "actview";
import { btnStyle, hintStyle, inputStyle } from "../../styles";
import { PageShell, Section } from "./shared";

// ============================================================
// P1 useReducer → reactive 状态 + action 函数对象
// ============================================================
function DemoReducer() {
  const state = reactive({
    items: [] as { id: number; text: string; done: boolean }[],
    filter: 'all' as 'all' | 'active' | 'done',
  })
  const draft = ref('')

  // reducer 的等价物 = 按 action 名分组的转移函数(直接改 reactive,无需 dispatch)
  const actions = {
    add() {
      const text = draft.value.trim()
      if (!text) return
      state.items.push({ id: Date.now(), text, done: false })
      draft.value = ''
    },
    toggle(id: number) {
      const it = state.items.find((i) => i.id === id)
      if (it) it.done = !it.done
    },
    remove(id: number) {
      state.items = state.items.filter((i) => i.id !== id)
    },
    setFilter(f: 'all' | 'active' | 'done') {
      state.filter = f
    },
  }

  const visible = computed(() =>
    state.items.filter((i) =>
      state.filter === 'all' ? true : state.filter === 'done' ? i.done : !i.done,
    ),
  )

  return (
    <div>
      <input
        style={inputStyle}
        value={draft.value}
        oninput={(e: any) => (draft.value = e.target.value)}
        placeholder="新待办…"
      />
      <button style={btnStyle} onclick={() => actions.add()}>
        添加
      </button>
      <button style={btnStyle} onclick={() => actions.setFilter('all')}>
        全部
      </button>
      <button style={btnStyle} onclick={() => actions.setFilter('active')}>
        未完成
      </button>
      <button style={btnStyle} onclick={() => actions.setFilter('done')}>
        已完成
      </button>
      <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
        {visible.value.map((i) => (
          <li key={i.id}>
            <span style={i.done ? 'text-decoration:line-through;color:#94a3b8' : ''}>
              {i.text}
            </span>{' '}
            <button onclick={() => actions.toggle(i.id)}>✓</button>{' '}
            <button onclick={() => actions.remove(i.id)}>×</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function UseReducerPage() {
  return (
    <PageShell backTo="/react-patterns" backLabel="返回组合写法索引">
      <Section
        title="P1 useReducer → reactive 状态 + action 函数对象"
        reactCode={'const [state, dispatch] = useReducer(reducer, init);\ndispatch({ type: "add", text });'}
        actviewCode={'const state = reactive({ items: [], filter: "all" });\nconst actions = { add() {…}, toggle(id) {…} };\n// render 里读 state.* → 自动追踪;actions.*() → 直接触发'}
      >
        <DemoReducer />
      </Section>
    </PageShell>
  )
}

// ============================================================
// P2 useLayoutEffect → watch flush:'post'(DOM 已更新,绘制前)
// ============================================================
function DemoLayoutEffect() {
  const box = ref<HTMLElement | null>(null)
  const words = ref(2)
  const width = ref(0)

  // React: useLayoutEffect(() => setWidth(box.offsetWidth)) —— DOM 后、绘制前
  watch(
    () => [box.value, words.value] as const,
    ([el]) => {
      if (el) width.value = el.offsetWidth
    },
    { flush: 'post' },
  )

  return (
    <div>
      <div
        ref={box}
        style="display:inline-block;background:#e2e8f0;padding:8px;border-radius:6px"
      >
        {'单词 '.repeat(words.value)}
      </div>{' '}
      <button style={btnStyle} onclick={() => words.value++}>
        加一个单词
      </button>
      <span style={hintStyle}>实测宽度:{width.value}px(post 时序:DOM 后/绘制前)</span>
    </div>
  )
}

export function UseLayoutEffectPage() {
  return (
    <PageShell backTo="/react-patterns" backLabel="返回组合写法索引">
      <Section
        title="P2 useLayoutEffect → watch flush:'post'(DOM 已更新,绘制前)"
        reactCode={'useLayoutEffect(() => {\n  setWidth(box.offsetWidth);\n});'}
        actviewCode={'watch(() => [box.value, words.value],\n  ([el]) => el && (width.value = el.offsetWidth),\n  { flush: "post" });'}
      >
        <DemoLayoutEffect />
      </Section>
    </PageShell>
  )
}

// ============================================================
// P3 useInsertionEffect → watch flush:'sync'(数据变更同步栈内,DOM 变更前)
// ============================================================
function DemoInsertionEffect() {
  const theme = ref<'blue' | 'red'>('blue')
  const styleId = 'demo-sync-style'

  // 主题变更的同一同步栈内先注入 <style>,再让渲染更新 DOM
  watch(
    theme,
    (t) => {
      let tag = document.getElementById(styleId) as HTMLStyleElement | null
      if (!tag) {
        tag = document.createElement('style')
        tag.id = styleId
        document.head.appendChild(tag)
      }
      const color = t === 'red' ? '#dc2626' : '#2563eb'
      tag.textContent = `.demo-inserted .accent{background:${color};color:#fff}`
    },
    { flush: 'sync' },
  )
  onUnmounted(() => document.getElementById(styleId)?.remove())

  return (
    <div class="demo-inserted">
      <span class="accent" style="padding:4px 10px;border-radius:6px">
        同步注入样式的着色块
      </span>{' '}
      <button style={btnStyle} onclick={() => (theme.value = theme.value === 'blue' ? 'red' : 'blue')}>
        切换主题色
      </button>
      <span style={hintStyle}>head 中的 style 标签随切换同步更新</span>
    </div>
  )
}

export function UseInsertionEffectPage() {
  return (
    <PageShell backTo="/react-patterns" backLabel="返回组合写法索引">
      <Section
        title="P3 useInsertionEffect → watch flush:'sync'(DOM 变更前)"
        reactCode={'useInsertionEffect(() => {\n  injectStyles(theme);\n}, [theme]);'}
        actviewCode={'watch(() => props.theme, inject, { flush: "sync" });'}
      >
        <DemoInsertionEffect />
      </Section>
    </PageShell>
  )
}

// ============================================================
// P4 useSyncExternalStore → 订阅外部世界 + ref 桥接 + 卸载退订
// ============================================================
function DemoExternalStore() {
  // 外部源 A:浏览器在线状态
  const online = ref(navigator.onLine)
  const on = () => (online.value = true)
  const off = () => (online.value = false)
  window.addEventListener('online', on)
  window.addEventListener('offline', off)
  // 外部源 B:setInterval 时钟
  const now = ref(new Date().toLocaleTimeString())
  const timer = setInterval(() => (now.value = new Date().toLocaleTimeString()), 1000)

  // 外部世界不走 effectScope → 卸载时手动退订(等价 useSyncExternalStore 的 unsubscribe)
  onUnmounted(() => {
    window.removeEventListener('online', on)
    window.removeEventListener('offline', off)
    clearInterval(timer)
  })

  return (
    <div>
      <span style={hintStyle}>
        在线:{online.value ? '是' : '否'} | 时钟:{now.value}
      </span>
    </div>
  )
}

export function UseSyncExternalStorePage() {
  return (
    <PageShell backTo="/react-patterns" backLabel="返回组合写法索引">
      <Section
        title="P4 useSyncExternalStore → 订阅外部世界 + ref 桥接"
        reactCode={'useSyncExternalStore(subscribe, () => store.get());'}
        actviewCode={'window.addEventListener("online", on);\nwindow.addEventListener("offline", off);\nonUnmounted(() => { /* 退订 */ });'}
        note="ActView 同步渲染无 tearing——桥接只需「订阅 → 写 ref」,无需快照校验"
      >
        <DemoExternalStore />
      </Section>
    </PageShell>
  )
}

// ============================================================
// P5 useTransition → pending 标志 + setTimeout 错峰(诚实降级:非时间切片)
// ============================================================
function DemoTransition() {
  const tab = ref<'light' | 'heavy'>('light')
  const pending = ref(false)

  const switchTab = (next: 'light' | 'heavy') => {
    pending.value = true
    // 错峰:让「pending」先行渲染,重内容稍后上屏(非并发时间切片)
    setTimeout(() => {
      tab.value = next
      pending.value = false
    }, 350)
  }

  const heavyRows = computed(() => {
    if (tab.value !== 'heavy') return []
    // 模拟重渲染成本
    let acc = 0
    for (let i = 0; i < 3e6; i++) acc += i % 7
    return Array.from({ length: 300 }, (_, i) => `row-${String(i).padStart(3, '0')}-${acc % 97}`)
  })

  return (
    <div>
      <button style={btnStyle} onclick={() => switchTab('light')} disabled={pending.value}>
        轻内容
      </button>{' '}
      <button style={btnStyle} onclick={() => switchTab('heavy')} disabled={pending.value}>
        重内容
      </button>{' '}
      {pending.value && <span style="color:#dc2626">⏳ 更新中…</span>}
      <div style={{ marginTop: 8, maxHeight: 160, overflow: 'auto', border: '1px solid #e2e8f0', padding: 6 }}>
        {tab.value === 'heavy'
          ? heavyRows.value.map((r) => (
              <div key={r} style={{ fontSize: 12 }}>
                {r}
              </div>
            ))
          : <div style={{ fontSize: 12 }}>轻内容面板(切换到「重内容」时注意 pending 提示)</div>}
      </div>
    </div>
  )
}

export function UseTransitionPage() {
  return (
    <PageShell backTo="/react-patterns" backLabel="返回组合写法索引">
      <Section
        title="P5 useTransition → pending 标志 + setTimeout 错峰(诚实降级:非时间切片)"
        reactCode={'const [pending, start] = useTransition();\nstart(() => setTab(next));'}
        actviewCode={'const pending = ref(false);\nconst switchTab = (next) => {\n  pending.value = true;\n  setTimeout(() => { tab.value = next; pending.value = false }, 350);\n};\n// render:{pending.value ? <Spinner/> : <Panel/>}'}>
        <DemoTransition />
      </Section>
    </PageShell>
  )
}

// ============================================================
// P6 useDeferredValue → watch + setTimeout 延迟写入副本 ref
// ============================================================
function DemoDeferredValue() {
  const keyword = ref('')      // 高优先级:输入框
  const deferred = ref('')     // 低优先级:大列表
  let timer: any

  watch(keyword, (v) => {
    clearTimeout(timer)
    timer = setTimeout(() => (deferred.value = v), 300)
  })

  const pool = computed(() => {
    const arr: string[] = []
    for (let i = 0; i < 20000; i++) arr.push(`item-${String(i).padStart(5, '0')}`)
    return arr
  })
  const matched = computed(() => pool.value.filter((x) => x.includes(deferred.value)).slice(0, 50))

  return (
    <div>
      <input style={inputStyle} value={keyword.value} oninput={(e: any) => (keyword.value = e.target.value)} placeholder="过滤 20000 项(输入不卡,列表延迟跟随)" />
      <span style={hintStyle}>deferred = "{deferred.value}" | 命中 {matched.value.length} 项</span>
      <div style={{ maxHeight: 140, overflow: 'auto', marginTop: 6 }}>
        {matched.value.map((x) => (
          <div key={x} style={{ fontSize: 12 }}>
            {x}
          </div>
        ))}
      </div>
    </div>
  )
}

export function UseDeferredValuePage() {
  return (
    <PageShell backTo="/react-patterns" backLabel="返回组合写法索引">
      <Section
        title="P6 useDeferredValue → watch + setTimeout 延迟副本"
        reactCode={'const deferred = useDeferredValue(keyword);'}
        actviewCode={'const deferred = ref("");\nwatch(keyword, (v) => {\n  clearTimeout(timer);\n  timer = setTimeout(() => (deferred.value = v), 300);\n});\n// 重列表用 deferred,输入框用 keyword —— 互不阻塞'}>
        <DemoDeferredValue />
      </Section>
    </PageShell>
  )
}

// ============================================================
// P7 useOptimistic → 乐观项 + 真值列表(完成迁移/失败回滚)
// ============================================================
function DemoOptimistic() {
  const messages = ref(['hello', 'world']) // 真值(服务端已确认)
  const optimistic = ref<{ id: number; text: string }[]>([]) // 乐观项(未确认)
  const draft = ref('')
  let seq = 0

  const send = () => {
    const text = draft.value.trim()
    if (!text) return
    const item = { id: ++seq, text }
    optimistic.value = [...optimistic.value, item] // 立即上屏
    draft.value = ''
    // 模拟服务端(800ms 后落库)
    setTimeout(() => {
      messages.value = [...messages.value, text]
      optimistic.value = optimistic.value.filter((i) => i !== item) // 迁移完成,回滚乐观项
    }, 800)
  }

  const merged = computed(() => [
    ...messages.value.map((t) => ({ text: t, pending: false })),
    ...optimistic.value.map((i) => ({ text: i.text, pending: true })),
  ])

  return (
    <div>
      <input style={inputStyle} value={draft.value} oninput={(e: any) => (draft.value = e.target.value)} placeholder="发一条消息…" />{' '}
      <button style={btnStyle} onclick={send}>
        发送
      </button>
      <div style={{ marginTop: 6 }}>
        {merged.value.map((m) => (
          <div style={{ fontSize: 13, opacity: m.pending ? 0.5 : 1, fontStyle: m.pending ? 'italic' : 'normal' }}>
            {m.text}
            {m.pending ? '(发送中…)' : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

export function UseOptimisticPage() {
  return (
    <PageShell backTo="/react-patterns" backLabel="返回组合写法索引">
      <Section
        title="P7 useOptimistic → 乐观项 + 真值列表(完成迁移/失败回滚)"
        reactCode={'const [optimistic, addOptimistic] = useOptimistic(\n  messages, (cur, text) => [...cur, { text }]\n);'}
        actviewCode={'const optimistic = ref([]);        // 乐观项\nasync function send(text) {\n  optimistic.value.push({ id, text });   // 立即上屏\n  try { messages.value.push(await api(text)) }\n  finally { optimistic.value = …filter… } // 回滚\n}'}>
        <DemoOptimistic />
      </Section>
    </PageShell>
  )
}

// ============================================================
// P8 useActionState → pending + async action + 表单提交拦截
// ============================================================
function DemoActionState() {
  const state = reactive({ result: '' as string | null, pending: false })

  const formAction = async (fd: FormData) => {
    state.pending = true
    try {
      await new Promise((r) => setTimeout(r, 800)) // 模拟请求
      state.result = `已处理:${fd.get('q')}`
    } finally {
      state.pending = false
    }
  }
  const onSubmit = (e: Event) => {
    e.preventDefault()
    formAction(new FormData(e.target as HTMLFormElement))
  }

  return (
    <form onsubmit={onSubmit}>
      <input style={inputStyle} name="q" placeholder="搜索…" />{' '}
      <button style={btnStyle} disabled={state.pending}>
        {state.pending ? '处理中…' : '提交'}
      </button>
      {state.result && <div style={hintStyle}>结果:{state.result}</div>}
    </form>
  )
}

export function UseActionStatePage() {
  return (
    <PageShell backTo="/react-patterns" backLabel="返回组合写法索引">
      <Section
        title="P8 useActionState → pending + async action + 表单提交拦截"
        reactCode={'const [state, formAction, pending] =\n  useActionState(actionFn, null);\n<form action={formAction}>…</form>'}
        actviewCode={'const state = reactive({ result: null, pending: false });\nconst formAction = async (fd) => {\n  state.pending = true;\n  try { state.result = await api(fd) } finally { state.pending = false }\n};\n// <form onsubmit={e => { e.preventDefault(); formAction(new FormData(e.target)) }}>'}
      >
        <DemoActionState />
      </Section>
    </PageShell>
  )
}
