// ============================================================
// ActView Reactivity 最小示例
//   点击按钮 → count.value++ → effect 自动把新值写回 DOM
//   （无 UI 框架参与：ref / computed / effect 直接驱动原生 DOM）
// ============================================================
import { computed, effect, ref } from '@actview/reactivity'

// ---- 响应式状态 ----
const count = ref(0)
const double = computed(() => count.value * 2)

// ---- 页面骨架 ----
const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('#app 容器不存在')

app.innerHTML = `
  <main class="demo">
    <h1>ActView · Reactivity</h1>
    <p class="row"><span>count</span><strong data-count>0</strong></p>
    <p class="row"><span>double（computed）</span><strong data-double>0</strong></p>
    <button type="button" data-inc>count + 1</button>
  </main>
`

const countEl = app.querySelector<HTMLElement>('[data-count]')!
const doubleEl = app.querySelector<HTMLElement>('[data-double]')!
const incBtn = app.querySelector<HTMLButtonElement>('[data-inc]')!

// ---- 响应式绑定 ----
// effect 收集依赖：回调里读了 count.value，count 变化时自动重跑
effect(() => {
  countEl.textContent = String(count.value)
})

// computed 是派生值：由 count 推导，count 变化后失效、下次读取时重算
effect(() => {
  doubleEl.textContent = String(double.value)
})

// ---- 交互：点击事件里改响应式状态，DOM 由上面的 effect 更新 ----
incBtn.addEventListener('click', () => {
  count.value++
})

// ---- 样式（纯 DOM 演示，不引入 UI 层）----
const style = document.createElement('style')
style.textContent = `
  body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-items: center;
    font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
    background: #0f172a;
    color: #e2e8f0;
  }
  .demo {
    min-width: 320px;
    padding: 32px 40px;
    border: 1px solid #334155;
    border-radius: 16px;
    background: #1e293b;
    box-shadow: 0 20px 40px rgb(0 0 0 / 0.35);
  }
  h1 { margin: 0 0 20px; font-size: 20px; letter-spacing: 0.02em; }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 32px;
    margin: 8px 0;
    color: #94a3b8;
  }
  .row strong { color: #38bdf8; font-variant-numeric: tabular-nums; }
  button {
    width: 100%;
    margin-top: 24px;
    padding: 10px 16px;
    border: 0;
    border-radius: 10px;
    font: inherit;
    font-weight: 600;
    color: #0f172a;
    background: #38bdf8;
    cursor: pointer;
  }
  button:hover { background: #7dd3fc; }
  button:active { transform: translateY(1px); }
`
document.head.append(style)
