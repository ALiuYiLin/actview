import { ref, computed } from '@actview/core'

export function ComputedDemo() {
  const price = ref(100)
  const quantity = ref(2)
  const total = computed(() => price.value * quantity.value)
  const firstName = ref('张')
  const lastName = ref('三')
  const fullName = computed(() => `${firstName.value}${lastName.value}`)

  return () => (
    <div class="guide-content">
      <h2>computed — 计算属性</h2>
      <p><code>computed</code> 基于其他响应式数据推导出新值，且结果会被缓存。</p>
      <div class="code-block">{`const price = ref(100)
const quantity = ref(2)
const total = computed(() => price.value * quantity.value)`}</div>
      <div class="demo-row">
        <span>单价：<strong class="hl">{price.value}</strong></span>
        <button onClick={() => price.value += 10}>+10</button>
        <button onClick={() => price.value = Math.max(0, price.value - 10)}>-10</button>
      </div>
      <div class="demo-row">
        <span>数量：<strong class="hl">{quantity.value}</strong></span>
        <button onClick={() => quantity.value++}>+1</button>
        <button onClick={() => quantity.value = Math.max(0, quantity.value - 1)}>-1</button>
      </div>
      <div class="demo-row result">
        总价：<strong class="hl">{total.value}</strong> 元
      </div>

      <h2 style="margin-top:2rem">字符串拼接</h2>
      <div class="code-block">{`const firstName = ref('张')
const lastName = ref('三')
const fullName = computed(() => firstName.value + lastName.value)`}</div>
      <div class="demo-row">
        <span>姓：</span>
        <button onClick={() => firstName.value = '李'}>设为"李"</button>
        <button onClick={() => firstName.value = '王'}>设为"王"</button>
        <span style="margin-left:1rem">名：</span>
        <button onClick={() => lastName.value = '四'}>设为"四"</button>
        <button onClick={() => lastName.value = '五'}>设为"五"</button>
      </div>
      <div class="demo-row result">
        完整姓名：<strong class="hl">{fullName.value}</strong>
      </div>
    </div>
  )
}
