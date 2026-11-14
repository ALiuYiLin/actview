import { createApp } from 'actview'
import { DocsLayout } from '@actview/vitepress'
import Page from '../docs/index.md'
import './style.css'

createApp(DocsLayout, { page: Page }).mount('#app')
