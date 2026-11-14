import { createDocsApp } from '@actview/vitepress'
import './style.css'

const pages = import.meta.glob('../docs/**/*.md') as Record<
  string,
  () => Promise<any>
>

createDocsApp({
  pages,
  container: '#app',
  siteData: { title: 'ActView Docs' },
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/' },
      { text: 'Guide page', link: '/guide' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Markdown MVP', link: '/' },
          { text: 'Guide page', link: '/guide' },
        ],
      },
    ],
    outline: [2, 3],
    aside: true,
    footer: {
      message: 'Built with ActView',
      copyright: 'ActView documentation',
    },
    docFooter: { prev: 'Previous page', next: 'Next page' },
  },
})
