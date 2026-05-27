import { ref } from "actview"

export function RefDemo() {
  const count = ref(0)
  const message = ref('hello')

  return () => (
    <div>
      <h2>ref 基础</h2>

      <section style="margin-bottom:16px;padding:12px;border:1px solid #ccc">
        <h3>计数器</h3>
        <p>count: <span style="font-size:2em;font-weight:bold">{count.value}</span></p>
        <button onClick={() => count.value += 1}>+1</button>
        <button onClick={() => count.value = 0}>重置</button>
      </section>

      <section style="padding:12px;border:1px solid #ccc">
        <h3>双向绑定</h3>
        <p>
          <input type="text" value={message.value}
            onInput={(e: any) => message.value = (e.target as HTMLInputElement).value} />
          &nbsp;你输入的是: <b>{message.value}</b>
        </p>
      </section>
    </div>
  )
}
