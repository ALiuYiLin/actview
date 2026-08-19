import { ref } from 'actview'

export function useCounter(initial) {
  const count = ref(initial)
  const increment = () => {
    count.value++
  }
  return { count, increment }
}
