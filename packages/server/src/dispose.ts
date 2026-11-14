// ============================================================
// @actview/server — SSR App 请求级清理
// ============================================================

import { invokeAppModelHooks } from '@actview/core/server-internal'
import type { AppContext } from '@actview/core/server-internal'

export interface DisposableSSRApp {
  _context: AppContext
  _unmountHooks?: Array<() => void>
}

/**
 * 结束 SSR 请求：触发 app 级 Model hooks 与 app.onUnmount 插件清理。
 *
 * 每个 SSRApp 只能调用一次；再次调用无可执行 hooks。
 */
export function disposeSSRApp(app: DisposableSSRApp): void {
  const context = app._context
  try {
    invokeAppModelHooks(context, 'beforeUnmount')
  } catch (err) {
    console.error('[actview] SSR app beforeUnmount hook 出错：', err)
  } finally {
    try {
      invokeAppModelHooks(context, 'unmount')
    } finally {
      context.root = null
      for (const hook of app._unmountHooks?.splice(0) ?? []) {
        try {
          hook()
        } catch (err) {
          console.error('[actview] SSR app.onUnmount 回调出错：', err)
        }
      }
    }
  }
}
