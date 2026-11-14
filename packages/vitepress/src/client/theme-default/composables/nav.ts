import { readonly, ref } from '@actview/reactivity'

const isScreenOpen = ref(false)

export function useNav() {
  return {
    isScreenOpen: readonly(isScreenOpen),
    openScreen: () => (isScreenOpen.value = true),
    closeScreen: () => (isScreenOpen.value = false),
    toggleScreen: () => (isScreenOpen.value = !isScreenOpen.value),
  }
}
