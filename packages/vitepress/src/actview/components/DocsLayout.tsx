import {
  ActViewComponent,
  Component,
  Dynamic,
  Prop,
} from 'actview'

/**
 * Phase 1 最小文档壳：只保证页面内容在文档结构里渲染。
 * 完整 VitePress 默认主题（导航 / 侧栏 / outline）在后续阶段移植。
 */
@Component({ name: 'DocsLayout' })
export class DocsLayout extends ActViewComponent<{ page?: any }> {
  @Prop
  page!: any

  render() {
    return (
      <div class="vp-layout">
        <header class="vp-nav">
          <a class="vp-nav-title" href="/">
            ActView Docs
          </a>
        </header>
        <div class="vp-content">
          <main class="vp-main">
            <Dynamic is={this.page} />
          </main>
        </div>
      </div>
    )
  }
}
