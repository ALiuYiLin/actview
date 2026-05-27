import { ref, reactive, watch, watchEffect } from "actview"

export function WatchDemo() {
  const count = ref(0)
  const user = reactive({ name: 'Alice', age: 25 })

  // watch ref
  watch(count, (newVal, oldVal) => {
    console.log(`[watch ref] count: ${oldVal} → ${newVal}`)
  })

  // watch getter
  watch(() => user.age, (newVal, oldVal) => {
    console.log(`[watch getter] user.age: ${oldVal} → ${newVal}`)
  })

  // watchEffect — 自动追踪内部用到的响应式数据
  watchEffect(() => {
    console.log(`[watchEffect] count=${count.value}, user.name=${user.name}`)
  })

  return () => (
    <div>
      <h2>watch / watchEffect</h2>

      <section style="margin-bottom:16px;padding:12px;border:1px solid #ccc">
        <h3>watch ref</h3>
        <p>count: <b>{count.value}</b></p>
        <button onClick={() => count.value += 1}>+1</button>
        <button onClick={() => count.value = 0}>重置</button>
        <p style="color:#888;font-size:0.9em">查看控制台输出</p>
      </section>

      <section style="padding:12px;border:1px solid #ccc">
        <h3>watch getter + watchEffect</h3>
        <p>user.name: <b>{user.name}</b></p>
        <p>user.age:  <b>{user.age}</b></p>
        <button onClick={() => user.name = user.name === 'Alice' ? 'Bob' : 'Alice'}>切换名字</button>
        <button onClick={() => user.age += 1}>年龄 +1</button>
        <p style="color:#888;font-size:0.9em">查看控制台输出</p>
      </section>
    </div>
  )
}
