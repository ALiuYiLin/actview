import { createApp } from 'actview'
import { devtoolsPlugin } from '@actview/devtools'
import './styles.css'
import { App } from './App'

const app = createApp(App)

if (import.meta.env.MODE !== 'production') {
  app.use(devtoolsPlugin, {
    appName: 'ActView Playground',
    bridge: true,
    performance: true,
  })
}

app.mount('#app')
