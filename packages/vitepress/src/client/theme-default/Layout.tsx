import './extract-css/Layout.css?scoped'
import {
  ActViewComponent,
  Component,
  Dynamic,
  Prop,
} from 'actview'

export class Layout extends ActViewComponent<{ page?: any }> {
  // @Prop 用函数式调用，避免 scoped Babel 在 Phase 1 解析 legacy decorator 语法。
  page!: any

  render() {
    return (
      <div class="Layout">
        <header class="VPNav">
          <a class="VPNavBarTitle" href="/">
            ActView Docs
          </a>
        </header>
        <div class="VPContent">
          <main class="VPDoc">
            <Dynamic is={this.page} />
          </main>
        </div>
      </div>
    )
  }
}

Prop(Layout.prototype, 'page')
Component({ name: 'Layout' })(Layout)
