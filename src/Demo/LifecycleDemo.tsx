import { ref, onCreated, onMounted, onBeforeUnmount } from 'actview'

export function LifecycleDemo() {
  const log = ref<string[]>([])
  const show = ref(true)

  // 用微任务延迟更新 log，避免在 mount 中同步触发 reactive re-render
  function add(msg: string) {
    console.log('[lifecycle]', msg)
    queueMicrotask(() => {
      log.value = [...log.value, msg]
    })
  }

  function Child() {
    const count = ref(0)

    onCreated(() => {
        add('  [Child] created')
        console.log('  [Child] created')
      }
    )
    onMounted(
      (inst) => {
        add('  [Child] mounted')
        console.log('  [Child] mounted, instance:', inst);
      }
    )
    onBeforeUnmount((inst) => {
      add('  [Child] beforeUnmount')
      console.log('  [Child] beforeUnmount, instance:', inst);
    })

    return () => (
      <div style="margin:8px 0;padding:8px;border:1px solid #646cff;border-radius:4px">
        <span style="color:#646cff">Child 组件</span>
        <button onClick={() => count.value += 1} style="margin-left:8px">count={count.value}</button>
      </div>
    )
  }

  onCreated(() => add('[Parent] created'))
  onMounted((inst) => {
    add('[Parent] mounted')
    console.log('[Parent] mounted, instance:', inst)
  })
  onBeforeUnmount((inst) => {
    add('[Parent] beforeUnmount')
    console.log('[Parent] beforeUnmount, instance:', inst)
  })

  return () => (
    <div style="max-width:600px;margin:0 auto;padding:1rem">
      <h2 style="margin-bottom:0.5rem">Lifecycle Demo</h2>
      <p style="color:#888;font-size:0.9rem;margin-bottom:1rem">
        onCreated / onMounted / onBeforeUnmount 测试（查看控制台 + 下方日志）
      </p>

      <button onClick={() => show.value = !show.value}
        style="padding:4px 12px;border:1px solid #333;border-radius:4px;cursor:pointer;margin-bottom:8px">
        {show.value ? '卸载 Child' : '挂载 Child'}
      </button>

      {show.value ? <Child /> : null}

      <div style="margin-top:1rem;font-size:0.8rem;color:#999;line-height:1.8;white-space:pre-wrap">
        {log.value.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  )
}
