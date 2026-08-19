import { ref, watchEffect } from 'actview'

export function useLogger(source) {
  const log = ref<number[]>([])
  watchEffect(() => {
    log.value.push(source.value)
  })
  return { log }
}
