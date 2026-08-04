import { defineComponent } from './component'
import { getCurrentInstance, onBeforeUnmount } from './lifecycle'
import { updateProps } from './renderer'

// ============================================================
// KeepAlive — 缓存组件实例与 DOM，切换时不销毁不重建
//   <KeepAlive><component is={cur} /></KeepAlive>
//   或 <KeepAlive><CompA v-if="..."/></KeepAlive>（子组件带 key）
//
// 机制：
//   1. render 给子 VNode 打 __keepAlive 标记（cache/storage/key）
//   2. renderer 的 unmount 检测到该标记 → DOM 移入隐藏容器 storage，
//      实例保留（effect 不停止，隐藏容器内继续响应式更新）
//   3. 切换回命中缓存 → 更新 props + DOM 移回挂载容器 + instance.update()
//      （patch 入口识别 newVnode.component 已存在 → 走 patchComponent 复用）
//   4. KeepAlive 自身卸载时清空缓存并真正卸载所有缓存实例
//
// 注意：子组件需为单根元素（subTree.el 不能为 null，Fragment 不支持）
// ============================================================

export const KeepAlive = defineComponent(function (props: any) {
  const cache = new Map<any, any>()
  const storage = document.createElement('div')
  const self = getCurrentInstance() as any

  onBeforeUnmount(() => {
    cache.forEach((vnode) => vnode.component?.unmount?.())
    cache.clear()
  })

  return () => {
    const child = props.children
    if (child && typeof child === 'object') {
      const key = child.key != null ? child.key : child.type
      if (cache.has(key)) {
        // 命中缓存：更新 props、恢复 DOM、复用实例（不重建）
        const cached = cache.get(key)
        const instance = cached.component
        cached.props = { ...(child.props || {}) }
        updateProps(instance.props, child.props)
        const el = instance?.subTree?.el ?? cached.el
        if (el && self.container && el.parentNode !== self.container) {
          self.container.appendChild(el) // 从隐藏容器移回挂载容器
        }
        instance?.update?.()
        return cached
      }
      child.__keepAlive = { cache, storage, key }
    }
    return child
  }
})
