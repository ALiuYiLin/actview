import { computed } from '@actview/reactivity'

export function useLangs(_options: any = {}) {
  const currentLang = computed(() => ({
    link: '/',
    label: 'English',
    text: 'English',
    lang: 'en',
    dir: 'ltr',
  }))
  const localeLinks = computed(() => [] as any[])
  return { currentLang, localeLinks, hasLanguages: computed(() => false) }
}
