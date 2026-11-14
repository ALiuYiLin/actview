import {
  ActViewComponent,
  Component,
  Mounted,
  Prop,
  Ref,
  Unmounted,
  createApp,
} from 'actview'
import { Layout } from '../theme-default/Layout'
import { setHeaders, setSidebar } from '../theme-default/composables/layout'
import { setPageData, setThemeData } from '../theme-default/composables/data'
import { route } from '../theme-default/composables/route'

export type DocsPageModule = {
  default: any
  __pageData?: any
}

export interface DocsAppOptions {
  pages: Record<string, () => Promise<DocsPageModule>>
  themeConfig?: Record<string, any>
  siteData?: Record<string, any>
  container?: Element | string
}

function normalizeRoute(path: string): string {
  if (!path || path === '/') return '/'
  return path.replace(/\/+$/, '')
}

function resolvePageKey(
  pages: Record<string, () => Promise<DocsPageModule>>,
  path: string,
): string | null {
  const clean = normalizeRoute(path)
  const candidates =
    clean === '/'
      ? ['/index.md', 'index.md']
      : [`${clean}.md`, `${clean}/index.md`]
  for (const key of Object.keys(pages)) {
    if (candidates.some((candidate) => key.endsWith(candidate))) return key
  }
  return null
}

@Component({ name: 'DocsApp' })
export class DocsApp extends ActViewComponent<DocsAppOptions> {
  pages!: Record<string, () => Promise<DocsPageModule>>
  themeConfig?: Record<string, any>

  page: any = null
  loading = true
  private popstateHandler = () => {
    void this.load(location.pathname)
  }

  mounted(): void {
    void this.load(location.pathname)
    window.addEventListener('popstate', this.popstateHandler)
  }

  unmounted(): void {
    window.removeEventListener('popstate', this.popstateHandler)
  }

  private async load(path: string): Promise<void> {
    this.loading = true
    const key = resolvePageKey(this.$props.pages, path)
    if (!key) {
      this.page = null
      this.loading = false
      return
    }
    const module = await this.$props.pages[key]()
    setPageData(module.__pageData ?? {})
    setHeaders(module.__pageData?.headers ?? [])
    const sidebar = this.$props.themeConfig?.sidebar
    setSidebar(Array.isArray(sidebar) ? sidebar : [])
    route.value = {
      path: normalizeRoute(path),
      hash: typeof location !== 'undefined' ? location.hash : '',
      query: '',
      data: module.__pageData,
    }
    this.page = module.default
    this.loading = false
  }

  render() {
    if (this.loading && !this.page) {
      return <div class="vp-loading">Loading…</div>
    }
    return <Layout page={this.page} />
  }
}

Prop(DocsApp.prototype, 'pages')
Prop(DocsApp.prototype, 'themeConfig')
Ref(DocsApp.prototype, 'page')
Ref(DocsApp.prototype, 'loading')
Mounted(DocsApp.prototype, 'mounted')
Unmounted(DocsApp.prototype, 'unmounted')
Component({ name: 'DocsApp' })(DocsApp)

export function createDocsApp(options: DocsAppOptions) {
  setThemeData({
    ...(options.siteData ?? {}),
    themeConfig: options.themeConfig ?? {},
  })
  const app = createApp(DocsApp as any, {
    pages: options.pages,
    themeConfig: options.themeConfig ?? {},
  })
  app.mount(options.container ?? '#app')
  return app
}
