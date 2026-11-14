import { computed, readonly, ref } from '@actview/reactivity'
import { isActive } from './layout'
import { pageData } from './data'

const isOpen = ref(false)

export function useSidebarControl() {
  return {
    isOpen: readonly(isOpen),
    open: () => (isOpen.value = true),
    close: () => (isOpen.value = false),
    toggle: () => (isOpen.value = !isOpen.value),
  }
}

export function useCloseSidebarOnEscape(close: () => void) {
  if (typeof window === 'undefined') return
  window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape' && isOpen.value) close()
  })
}

export function useSidebarItemControl(item: any) {
  const collapsed = ref(!!item?.collapsed)
  const collapsible = computed(() => item?.collapsed != null)
  const isLink = computed(() => !!item?.link)
  const isActiveLink = computed(() =>
    isActive(pageData.value.relativePath, item?.link),
  )
  const hasActiveLink = computed(() => isActiveLink.value)
  const hasChildren = computed(
    () => !!(item?.items && item.items.length),
  )
  return {
    collapsed,
    collapsible,
    isLink,
    isActiveLink,
    hasActiveLink,
    hasChildren,
    toggle() {
      if (collapsible.value) collapsed.value = !collapsed.value
    },
  }
}

export {}
