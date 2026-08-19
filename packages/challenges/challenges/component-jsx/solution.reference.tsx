import { ref } from 'actview'

export function Counter() {
  const count = ref(0)
  return (
    <div>
      <p data-testid="count">count: {count.value}</p>
      <button data-testid="inc" onClick={() => count.value++}>
        +1
      </button>
    </div>
  )
}
