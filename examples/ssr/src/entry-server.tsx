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

const server = http.createServer(async (req, res) => {
  try {
    // 静态资源：客户端水合 bundle（IIFE，由 tsup 产出）
    if (req.url === '/client.js') {
      const js = readFileSync(path.join(__dirname, 'entry-client.js'))
      res.writeHead(200, { 'content-type': 'application/javascript' })
      res.end(js)
      return
    }
    if (req.url !== '/') {
      res.writeHead(404, { 'content-type': 'text/plain' })
      res.end('Not Found')
      return
    }

    // 1) 服务端预取数据（真实场景：DB / API）
    const posts = await fetchPosts()

    // 2) SSR：渲染组件树为 HTML（async 版本 await 组件内 serverPrefetch 同样可用）
    const appHtml = await renderToStringAsync(<App initialPosts={posts} />)

    // 3) 组装页面：SSR HTML + 数据注入 + 客户端水合脚本
    const serialized = JSON.stringify(posts).replace(/</g, '\\u003c')
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ActView SSR Demo</title>
  <style>
    body { font-family: system-ui, "Segoe UI", sans-serif; background: #f6f7f9; margin: 0; color: #1f2937; }
    .app { max-width: 680px; margin: 0 auto; padding: 40px 20px 60px; }
    .title { font-size: 26px; margin: 0 0 6px; }
    .sub { color: #6b7280; margin: 0 0 28px; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 18px 20px; margin-bottom: 20px; }
    .card h2 { font-size: 16px; margin: 0 0 6px; }
    .hint { color: #9ca3af; font-size: 12px; margin: 0 0 12px; }
    .row { display: flex; align-items: center; gap: 12px; }
    button { border: none; border-radius: 6px; padding: 8px 16px; font-size: 14px; cursor: pointer; }
    .inc { background: #2563eb; color: #fff; }
    .reset { background: #e5e7eb; color: #374151; }
    .val { font-size: 22px; font-weight: 600; min-width: 24px; text-align: center; }
    .posts { list-style: none; padding: 0; margin: 0; }
    .post { padding: 10px 0; border-top: 1px solid #f3f4f6; display: flex; flex-direction: column; gap: 2px; }
    .post:first-child { border-top: none; }
    .post span { color: #6b7280; font-size: 13px; }
  </style>
</head>
<body>
  <div id="app">${appHtml}</div>
  <script>window.__INITIAL_DATA__ = ${serialized}</script>
  <script src="/client.js"></script>
</body>
</html>`

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
