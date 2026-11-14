import { createApp } from 'actview'
import { Layout } from '@actview/vitepress'
import Page from '../docs/index.md'
import './style.css'

createApp(Layout, { page: Page }).mount('#app')
