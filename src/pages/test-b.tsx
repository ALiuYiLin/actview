import { ref } from "@actview/core"

const hash = `ref_b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const uniqueRef = ref(hash, hash)

export function TestB() {
  return () => (
    <div>
      <h2>测试页面 B</h2>
      <p>唯一 ref: {uniqueRef.value}</p>
    </div>
  )
}
