import { shallowRef } from '@actview/reactivity'
import { pageData } from './data'

export const route = shallowRef<any>({
  path: '/',
  hash: '',
  query: '',
  data: pageData.value,
})

export function useRoute() {
  return route
}

export function useRouter() {
  return {
    route,
    go(to: string) {
      if (typeof window !== 'undefined') {
        window.location.href = to
      }
    },
  }
}
