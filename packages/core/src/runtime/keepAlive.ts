import { defineComponent } from './component'
import { getCurrentInstance, onBeforeUnmount } from './lifecycle'
import { updateProps } from './renderer'
import { invokeHooks } from './mountComponent'

// ============================================================
// KeepAlive — 缓存组件实例与 DOM，切换时不销毁不重建
//   <KeepAlive><component is={cur} /></KeepAlive>
//   或 <KeepAlive><CompA v-if="..."/></KeepAlive>（子组件带 key）
//
// 增强：include / exclude（组件名匹配）、max（LRU 淘汰）、
//       onActivated / onDeactivated（激活/失活钩子）
//
// 机制：
//   1. render 给子 VNode 打 __keepAlive 标记（cache/storage/key/max）
//   2. renderer 的 unmount 检测到该标记 → DOM 移入隐藏容器 storage，
//      实例保留（effect 不停止）+ 触发 deactivated
//   3. 切换回命中缓存 → 更新 props + DOM 移回挂载容器 + instance.update()
//      + 触发 activated（LRU：命中后移到末尾）
//   4. KeepAlive 自身卸载时清空缓存并真正卸载所有缓存实例
//
// 注意：子组件需为单根元素（subTree.el 不能为 null，Fragment 不支持）
// ============================================================

/** 匹配 include/exclude：数组逐项、正则 test、逗号分隔字符串 */
function matches(pattern: any, name: string): boolean {
  if (Array.isArray(pattern)) return pattern.some((p) => matches(p, name))
  if (pattern instanceof RegExp) return pattern.test(name)
  if (typeof pattern === 'string')
    return pattern
      .split(',')
      .map((s) => s.trim())
      .includes(name)
  return false
}

/** 取组件名：优先组件对象 name，其次标签字符串 */
function getComponentName(child: any): string {
  const type = child.type === 'component' ? child.props?.is : child.type
  if (type && typeof type === 'object') return type.name || ''
  if (typeof type === 'string') return type
  return ''
}

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
      const realType =
        child.type === 'component' ? (child.props?.is ?? 'div') : child.type
      const key = child.key != null ? child.key : realType
      const name = getComponentName(child)

      // include / exclude 过滤（未命中则不缓存，直接渲染）
      if (props.include && !matches(props.include, name)) return child
      if (props.exclude && matches(props.exclude, name)) return child

      if (cache.has(key)) {
        // 命中缓存：LRU 移到末尾 + 恢复 DOM + 复用实例 + 触发 activated
        const cached = cache.get(key)
        cache.delete(key)
        cache.set(key, cached)
        const instance = cached.component
        cached.props = { ...(child.props || {}) }
        updateProps(instance.props, child.props)
        const el = instance?.subTree?.el ?? cached.el
        if (el && self.container && el.parentNode !== self.container) {
          self.container.appendChild(el) // 从隐藏容器移回挂载容器
        }
        instance?.update?.()
        invokeHooks(instance.activated)
        // 重新打标记：本次复用结束后，下次卸载仍需走缓存分支
        cached.__keepAlive = { cache, storage, key, max: props.max }
        return cached
      }

      child.__keepAlive = { cache, storage, key, max: props.max }
    }
    return child
  }
})
