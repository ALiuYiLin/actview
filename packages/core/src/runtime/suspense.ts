import { defineComponent } from './component'
import { getCurrentInstance, onBeforeUnmount } from './lifecycle'
import { ref } from '../reactivity/ref'

// ============================================================
// Suspense + lazy — 异步组件加载
//   <Suspense fallback={<span>loading...</span>}>
//     <LazyComp />
//   </Suspense>
//   const LazyComp = lazy(() => import('./Comp'))
//
// 机制：
//   1. 模块级栈：Suspense 挂载时入栈、卸载时出栈
//   2. lazy 组件 setup 里向最近的 Suspense 注册（pending=true → 显示 fallback），
//      并启动 loader；未完成时渲染 null（占位）
//   3. loader 完成：lazy 内部 loaded ref 置真（重渲染真实组件）+
//      Suspense resolve（pending=false → 显示 children）
//   4. loader 拒绝：lazy render 抛错 → 交给 ErrorBoundary 处理
// ============================================================

const suspenseStack: any[] = []

export function pushSuspense(instance: any) {
  suspenseStack.push(instance)
}

export function popSuspense(instance: any) {
  const i = suspenseStack.indexOf(instance)
  if (i >= 0) suspenseStack.splice(i, 1)
}

/** 返回最近的 Suspense 实例（栈顶），没有则 null */
function getCurrentSuspense(): any {
  return suspenseStack.length ? suspenseStack[suspenseStack.length - 1] : null
}

export const Suspense = defineComponent(function (props: any) {
  const self = getCurrentInstance()!
  const pending = ref(false)
  ;(self as any).suspenseCtx = {
    register() {
      pending.value = true
    },
    resolve() {
      pending.value = false
    },
  }

  pushSuspense(self)
  onBeforeUnmount(() => popSuspense(self))

  return () => (pending.value ? props.fallback ?? null : props.children)
})

const REACT_ELEMENT_TYPE = Symbol.for('react.element')

function createVNode(type: any): any {
  return { $$typeof: REACT_ELEMENT_TYPE, type, key: null, ref: null, props: null }
}

/**
 * 异步组件：loader 返回 Promise<组件>（组件需为 defineComponent 产物，
 * 即 { __setup }；模块 `import('./x')` 请用 m.default）
 */
export function lazy(loader: () => Promise<any>) {
  let comp: any = null
  let loadError: any = null
  let started = false
  const loaded = ref(false)

  const start = (ctx: any) => {
    if (started) return
    started = true
    ctx?.register()
    loader()
      .then((m: any) => {
        comp = m.default ?? m
        loaded.value = true
        ctx?.resolve()
      })
      .catch((e: any) => {
        loadError = e
        loaded.value = true
        ctx?.resolve()
      })
  }

  return defineComponent(function () {
    // 向最近的 Suspense 注册（无 Suspense 时 ctx 为 null，加载完成后直接渲染）
    start((getCurrentInstance() as any)?.suspenseCtx ?? getCurrentSuspense()?.suspenseCtx)

    return () => {
      if (loadError) throw loadError
      if (loaded.value && comp) return createVNode(comp)
      return null // 未完成：占位（Suspense 显示 fallback）
    }
  })
}
