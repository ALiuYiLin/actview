import { ref, reactive, watch } from 'actview'
import './bugs.css'

/**
 * BUGS — 响应式系统已知问题
 */

function Bug1NestedProxy() {
  const user = reactive({ nested: { count: 1 } } as any)
  const log = ref<string[]>([])

  const a = user.nested
  const b = user.nested
  log.value = [`a === b: ${a === b}`]

  watch(user.nested, (val: any) => {
    log.value = [...log.value, `watch 触发 count=${val.count}`]
  })

  return () => (
    <div class="bug-card">
      <div class="bug-title">Bug 1 — 嵌套 Proxy 不缓存</div>
      <div class="bug-desc">
        reactive 嵌套对象每次 get 应返回不同 Proxy（修复后 a === b 为 true，watch 不抛异常）
      </div>
      <div>nested.count = {user.nested.count}</div>
      <button class="bug-btn" onClick={() => user.nested.count += 1}>修改 nested.count</button>
      <div class="bug-log">
        {log.value.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  )
}

function Bug2WatchSameRef() {
  const log = ref<string[]>([])
  const user = reactive({ name: 'Alice', age: 25 })

  // @ts-ignore — 修复后 newVal 和 oldVal 应为不同对象
  watch(user, (newVal: any, oldVal: any) => {
    log.value = [...log.value, `new === old: ${newVal === oldVal}`]
  })

  return () => (
    <div class="bug-card">
      <div class="bug-title">Bug 2 — watch 新旧值同一引用</div>
      <div class="bug-desc">
        watch(reactiveObj) 回调的 newVal 和 oldVal 应不同（修复后 new === old 应为 false）
      </div>
      <div>user.age = {user.age}</div>
      <button class="bug-btn" onClick={() => user.age += 1}>修改 age</button>
      <div class="bug-log">
        {log.value.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  )
}

function Bug3ConsoleLog() {
  const count = ref(0)
  return () => (
    <div class="bug-card">
      <div class="bug-title">Bug 3 — event.ts:47 console.log 残留</div>
      <div class="bug-desc">
        EventBus.publish() 中遗留了 console.log，每次 ref 变化都会输出 subscribers map
      </div>
      <div>count = {count.value}</div>
      <button class="bug-btn" onClick={() => count.value += 1}>count+1（看控制台）</button>
    </div>
  )
}

function Bug4UnnecessaryAssign() {
  const obj = reactive({ x: 1 })
  return () => (
    <div class="bug-card">
      <div class="bug-title">Bug 4 — triggerRef.value = target（已确认有必要）</div>
      <div class="bug-desc">
        triggerRef.value 保存 target 引用用于追踪依赖对象，并非多余
      </div>
      <div>obj.x = {obj.x}</div>
      <button class="bug-btn" onClick={() => obj.x += 1}>obj.x+1</button>
    </div>
  )
}

function Bug5Typo() {
  return () => (
    <div class="bug-card">
      <div class="bug-title">Bug 5 — 参数命名 typo</div>
      <div class="bug-desc">
        <code>reactive.ts:12</code> 参数名 <code>inittialValue</code> 应为 <code>initialValue</code>
      </div>
    </div>
  )
}

export function BugsDemo() {
  return () => (
    <div class="bugs-page">
      <h2>响应式系统 Bugs</h2>
      <p>packages/core/reactivity/ 共 5 个已知问题，点击按钮可触发复现</p>

      <Bug1NestedProxy />
      <Bug2WatchSameRef />
      <Bug3ConsoleLog />
      <Bug4UnnecessaryAssign />
      <Bug5Typo />
    </div>
  )
}
