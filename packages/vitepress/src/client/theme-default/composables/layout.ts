import {
  computed,
  shallowRef,
  type ComputedRef,
} from '@actview/reactivity'
import { useData } from './data'

export function isActive(currentPath: string, link?: string): boolean {
  if (!link) return false
  return currentPath === link || currentPath.startsWith(link + '/')
}

export const headers = shallowRef<any[]>([])
export const sidebar = shallowRef<any[]>([])
const is960 = shallowRef(true)

export function useLayout() {
  const { frontmatter, theme } = useData()

  const isHome = computed(
    () => !!(frontmatter.value.isHome ?? frontmatter.value.layout === 'home'),
  )
  const hasSidebar = computed(
    () =>
      frontmatter.value.sidebar !== false &&
      sidebar.value.length > 0 &&
      !isHome.value,
  )
  const isSidebarEnabled = computed(() => hasSidebar.value && is960.value)
  const sidebarGroups = computed(() => sidebar.value)
  const hasAside = computed(() => {
    if (isHome.value) return false
    if (frontmatter.value.aside != null) return !!frontmatter.value.aside
    return theme.value.aside !== false
  })
  const leftAside = computed(() => {
    if (!hasAside.value) return false
    return frontmatter.value.aside == null
      ? theme.value.aside === 'left'
      : frontmatter.value.aside === 'left'
  })
  const hasLocalNav = computed(() => headers.value.length > 0)

  return {
    isHome,
    sidebar,
    sidebarGroups,
    hasSidebar,
    isSidebarEnabled,
    hasAside,
    leftAside,
    headers,
    hasLocalNav,
  }
}

export function setHeaders(next: any[]): void {
  headers.value = next
}

export function setSidebar(next: any[]): void {
  sidebar.value = next
}

export type LayoutInfo = {
  heroImageSlotExists: ComputedRef<boolean>
}
