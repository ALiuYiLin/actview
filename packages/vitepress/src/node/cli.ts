import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { createServer, type Plugin } from 'vite'
import jsxScoped from '@10coding/vite-plugin-jsx-scoped'
import { actviewMarkdown } from './actviewPlugin'

const VIRTUAL_SITE = 'virtual:actview-site'

export interface ActPressConfig {
  title?: string
  description?: string
  themeConfig?: Record<string, any>
  srcDir?: string
}

export interface ActPressOptions {
  docsRoot: string
  config: ActPressConfig
}

async function loadSiteConfig(docsRoot: string): Promise<ActPressConfig> {
  const configPath = path.join(docsRoot, '.vitepress', 'config.ts')
  try {
    const mod = await import(`${pathToFileURL(configPath).href}?t=${Date.now()}`)
    return (mod.default ?? mod) as ActPressConfig
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') {
      return {}
    }
    throw err
  }
}

function siteDataPlugin(config: ActPressConfig): Plugin {
  return {
    name: 'actview:site-data',
    enforce: 'pre',
    resolveId(id) {
      if (id === VIRTUAL_SITE) return `\0${VIRTUAL_SITE}`
      return null
    },
    load(id) {
      if (id === `\0${VIRTUAL_SITE}`) {
        return `export const siteConfig = ${JSON.stringify(config)}`
      }
      return null
    },
  }
}

function htmlFallbackPlugin(entryPath: string): Plugin {
  return {
    name: 'actview:html',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '/'
        const accept = req.headers.accept ?? ''
        if (
          !accept.includes('text/html') ||
          url.startsWith('/@') ||
          url.startsWith('/node_modules/') ||
          url.includes('.')
        ) {
          next()
          return
        }
        const html = `<!doctype html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ActView Docs</title>
</head>
<body>
<div id="app"></div>
<script type="module" src="/@fs/${entryPath.replace(/\\/g, '/')}"></script>
</body>
</html>`
        res.setHeader('Content-Type', 'text/html')
        res.end(await server.transformIndexHtml(url, html))
      })
    },
  }
}

export async function createActPressOptions(docsRoot: string): Promise<ActPressOptions> {
  const config = await loadSiteConfig(docsRoot)
  return { docsRoot, config }
}

export async function dev(options: ActPressOptions): Promise<void> {
  const docsRoot = path.resolve(options.docsRoot)
  const packageRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
  const repoRoot = path.resolve(packageRoot, '../..')
  const sourceEntry = path.join(packageRoot, 'src/client/entry.ts')
  const entryTs = fileURLToPath(new URL('../client/entry.ts', import.meta.url))
  const entryJs = fileURLToPath(new URL('../client/entry.js', import.meta.url))
  const entryPath = existsSync(sourceEntry)
    ? sourceEntry
    : existsSync(entryTs)
      ? entryTs
      : entryJs
  const server = await createServer({
    root: docsRoot,
    configFile: false,
    define: {
      __DEV__: 'true',
    },
    esbuild: {
      jsx: 'automatic',
      jsxImportSource: '@actview/jsx',
    },
    resolve: {
      alias: {
        '@actview/vitepress': path.join(packageRoot, 'src/client/index.ts'),
        'actview': path.join(repoRoot, 'packages/actview/src/index.ts'),
        '@actview/core': path.join(repoRoot, 'packages/core/src/index.ts'),
        '@actview/jsx/jsx-runtime': path.join(repoRoot, 'packages/jsx/src/jsx-runtime.ts'),
        '@actview/jsx/jsx-dev-runtime': path.join(repoRoot, 'packages/jsx/src/jsx-dev-runtime.ts'),
        '@actview/jsx': path.join(repoRoot, 'packages/jsx/src/index.ts'),
        '@actview/reactivity': path.join(repoRoot, 'packages/reactivity/src/index.ts'),
        '@actview/shared': path.join(repoRoot, 'packages/shared/src/index.ts'),
      },
    },
    plugins: [
      siteDataPlugin(options.config),
      jsxScoped(),
      actviewMarkdown(),
      htmlFallbackPlugin(entryPath),
    ],
    server: {
      fs: {
        allow: [docsRoot, path.resolve(docsRoot, '../..')],
      },
      open: true,
    },
  })
  await server.listen()
  server.printUrls()
}

export function parseCliArgs(argv: string[]): {
  command: string
  docsRoot: string
} {
  const command = argv[0] && !argv[0].startsWith('-') ? argv[0] : 'dev'
  const docsRoot = argv[1] ?? process.cwd()
  return { command, docsRoot }
}

export async function runCli(argv: string[] = process.argv.slice(2)): Promise<void> {
  const { command, docsRoot } = parseCliArgs(argv)
  if (command === 'dev') {
    const options = await createActPressOptions(docsRoot)
    await dev(options)
    return
  }
  console.error(`[actview] 暂不支持命令：${command}（当前支持 dev）`)
  process.exitCode = 1
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void runCli()
}
