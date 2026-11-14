import './theme-default/styles/base.css'
import './theme-default/styles/vars.css'
import './theme-default/styles/utils.css'
import './theme-default/styles/icons.css'
import './theme-default/styles/components/vp-doc.css'
import './theme-default/styles/components/vp-code.css'
import './theme-default/styles/components/custom-block.css'
import { createDocsApp } from './app/createDocsApp'
import { siteConfig } from 'virtual:actview-site'

const pages = import.meta.glob('/**/*.md') as Record<
  string,
  () => Promise<any>
>

createDocsApp({
  pages,
  container: '#app',
  siteData: siteConfig,
  themeConfig: siteConfig.themeConfig ?? {},
})
