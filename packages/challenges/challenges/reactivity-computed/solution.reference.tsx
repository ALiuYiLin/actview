import { computed } from 'actview'

export function useDouble(source) {
  return computed(() => source.value * 2)
}
