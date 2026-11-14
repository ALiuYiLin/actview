import {
  computed,
  ref,
  shallowRef,
} from '@actview/reactivity'

/** Phase 1/2 的最小主题数据服务；后续由 ActView app 注入完整 site/page data。 */
export const siteData = shallowRef<any>({
  lang: 'en',
  dir: 'ltr',
  title: 'ActView Docs',
  description: '',
  appearance: true,
  themeConfig: {
    outline: [2, 3],
    aside: true,
    sidebar: undefined,
    footer: undefined,
    externalLinkIcon: true,
  },
})

export const pageData = shallowRef<any>({
  relativePath: 'index.md',
  frontmatter: {},
  headers: [],
  params: {},
})

export function setPageData(data: any): void {
  pageData.value = data
}

export function setThemeData(data: any): void {
  siteData.value = { ...siteData.value, ...data }
}

const isDark = ref(false)
const hash = ref('')

export function setAppearance(next: 'dark' | 'light' | 'auto' | boolean): void {
  isDark.value = next === 'dark' || (next === 'auto' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', isDark.value)
  }
}

export function useData() {
  const site = computed(() => siteData.value)
  const page = computed(() => pageData.value)
  const frontmatter = computed(() => page.value.frontmatter ?? {})
  const theme = computed(() => site.value.themeConfig ?? {})
  return {
    site,
    page,
    frontmatter,
    theme,
    params: computed(() => page.value.params ?? {}),
    lang: computed(() => site.value.lang),
    dir: computed(() => frontmatter.value.dir || site.value.dir),
    localeIndex: computed(() => site.value.localeIndex || 'root'),
    title: computed(() => site.value.title),
    description: computed(() => site.value.description),
    isDark,
    setAppearance,
    hash,
  }
}
