import { ref, computed } from "actview"

export function ComputedDemo() {
  const firstName = ref('John')
  const lastName = ref('Doe')
  const fullName = computed(() => `${firstName.value} ${lastName.value}`)

  const price = ref(100)
  const quantity = ref(2)
  const total = computed(() => price.value * quantity.value)

  return () => (
    <div>
      <h2>computed 计算属性</h2>

      <section style="margin-bottom:16px;padding:12px;border:1px solid #ccc">
        <h3>全名拼接</h3>
        <p>
          <input value={firstName.value}
            onInput={(e: any) => firstName.value = (e.target as HTMLInputElement).value} />
          &nbsp;+&nbsp;
          <input value={lastName.value}
            onInput={(e: any) => lastName.value = (e.target as HTMLInputElement).value} />
        </p>
        <p>fullName = <b>{fullName.value}</b></p>
      </section>

      <section style="padding:12px;border:1px solid #ccc">
        <h3>购物车总价</h3>
        <p>
          单价: {price.value} &nbsp;
          <button onClick={() => price.value += 10}>+10</button>
          <button onClick={() => price.value = Math.max(0, price.value - 10)}>-10</button>
        </p>
        <p>
          数量: {quantity.value} &nbsp;
          <button onClick={() => quantity.value += 1}>+1</button>
          <button onClick={() => quantity.value = Math.max(0, quantity.value - 1)}>-1</button>
        </p>
        <p>total = {price.value} × {quantity.value} = <b>{total.value}</b></p>
      </section>
    </div>
  )
}
