import { ref } from "@actview/core"

const hash = `ref_a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const uniqueRef = ref(hash, hash)

export function TestA() {
  return () => (
    <div>
      <h2>测试页面 A</h2>
      <p>唯一 ref: {uniqueRef.value}</p>
    </div>
  )
}
