import http from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { renderToStringAsync } from 'actview'
import { App } from './App'
import { fetchPosts } from './data'

// 默认 3100（3000 常被其他 dev server 占用）；可用环境变量覆盖：PORT=8080 npm start
const PORT = Number(process.env.PORT ?? 3100)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
// 客户端构建产物目录（vite build 输出：index.html + assets/）
const CLIENT_DIR = path.join(__dirname, '..', 'dist')

const MIME: Record<string, string> = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

const server = http.createServer(async (req, res) => {
  try {
    const url = req.url ?? '/'

    // 静态资源：vite build 产物（assets/ 哈希文件）
    if (url.startsWith('/assets/')) {
      const file = path.join(CLIENT_DIR, url)
      if (!file.startsWith(CLIENT_DIR)) {
        res.writeHead(403)
        res.end('Forbidden')
        return
      }
      const body = readFileSync(file)
      res.writeHead(200, {
        'content-type': MIME[path.extname(file)] ?? 'application/octet-stream',
      })
      res.end(body)
      return
    }
    if (url !== '/') {
      res.writeHead(404, { 'content-type': 'text/plain' })
      res.end('Not Found')
      return
    }

    // 1) 服务端预取数据（真实场景：DB / API）
    const posts = await fetchPosts()

    // 2) SSR：渲染组件树为 HTML（async 版本 await 组件内 serverPrefetch 同样可用）
    const appHtml = await renderToStringAsync(<App initialPosts={posts} />)

    // 3) 组装页面：vite client 模板 + SSR HTML + 数据注入
    const template = readFileSync(path.join(CLIENT_DIR, 'index.html'), 'utf-8')
    const serialized = JSON.stringify(posts).replace(/</g, '\\u003c')
    const html = template
      .replace('<div id="app"></div>', `<div id="app">${appHtml}</div>`)
      .replace(
        '</head>',
        `<script>window.__INITIAL_DATA__ = ${serialized}</script></head>`
      )

    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(html)
  } catch (err) {
    console.error('[actview-ssr-demo] 渲染失败:', err)
    res.writeHead(500, { 'content-type': 'text/plain' })
    res.end('Internal Server Error')
  }
})

server.listen(PORT, () => {
  console.log(`[actview-ssr-demo] 已启动: http://localhost:${PORT}`)
})
