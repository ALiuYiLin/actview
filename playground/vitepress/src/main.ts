import { createApp } from 'actview'
import { Layout, setPageData, setThemeData } from '@actview/vitepress'
import Page, { __pageData } from '../docs/index.md'
import './style.css'

setPageData(__pageData)
setThemeData({
  title: 'ActView Docs',
  themeConfig: {
    nav: [{ text: 'Guide', link: '/' }],
    sidebar: [],
    outline: [2, 3],
    aside: true,
    docFooter: { prev: 'Previous page', next: 'Next page' },
  },
})

createApp(Layout, { page: Page }).mount('#app')
