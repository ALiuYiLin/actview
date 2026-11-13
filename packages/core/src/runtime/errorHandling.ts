// ============================================================
// 错误处理链 — setup / render / unmount 错误的统一入口（M3）
//
//   handleError(err, instance, info): boolean
//     1. 沿 instance.parent 链调用各实例的 errorCaptured 钩子
//        （钩子签名：(err, 钩子所属实例, info)）；任一返回 false
//        → 视为已捕获，立即停止向上传播，返回 true；
//     2. 没有任何钩子处理 → 交给该实例 appContext.config.errorHandler
//        （存在即调用，返回 true）；
//     3. 兜底 console.error 并返回 false（renderer 会继续上抛）。
//
// 返回值语义：true = 已处理（renderer 不再 throw）；false = 未处理。
// renderer 的用法统一为 `if (!handleError(...)) throw err`。
//
// 依赖收集边界（docs/renderer.md）：错误处理发生在 render
// effect 执行栈内（renderer 的 try/catch），钩子 / 全局 handler 里的响应式
// 读取不应被正在运行的 effect 收集，因此全程 pauseTracking。
// ============================================================

import { pauseTracking, resetTracking } from '@actview/reactivity'
import type { ComponentInternalInstance } from './instance'

/**
 * 统一错误处理入口。
 *
 * @param err 抛出的错误
 * @param instance 错误来源组件实例（可为 null，如根渲染前的错误）
 * @param info 错误阶段（'setup' / 'render' / 'unmount' 等，用于日志 / 钩子）
 * @returns true = 已被 errorCaptured / errorHandler 处理；false = 未处理
 */
export function handleError(
  err: unknown,
  instance: ComponentInternalInstance | null,
  info: string,
): boolean {
  // 错误钩子执行期间不收集依赖：renderer 在失败的 render effect 内调用本函数，
  // 钩子里的响应式读取（如 ErrorBoundary 的 error.value）不能算作该 effect 的依赖。
  pauseTracking()
  try {
    // ① errorCaptured：从出错组件自身开始，沿 parent 链向上
    let current = instance
    while (current) {
      const hooks = current.errorCaptured
      if (hooks && hooks.length > 0) {
        for (const hook of hooks) {
          try {
            const captured = hook(err, current, info)
            // false = 已捕获（对齐 Vue 3：返回 false 阻止继续向上传播）
            if (captured === false) return true
          } catch (hookError) {
            // 钩子自身出错：记录后继续向上，绝不递归回调 handleError（避免死循环）
            console.error('[actview] errorCaptured 钩子执行出错：', hookError)
          }
        }
      }
      current = current.parent
    }

    // ② 全局 errorHandler（同一 app 的实例共享 appContext）
    const errorHandler = instance?.appContext.config.errorHandler
    if (errorHandler) {
      try {
        errorHandler(err, instance, info)
      } catch (handlerError) {
        // 全局 handler 自身出错同样不能让错误处理链崩溃
        console.error('[actview] app.config.errorHandler 执行出错：', handlerError)
      }
      return true
    }

    // ③ 兜底：没有边界也没有全局 handler → 记录并交由 renderer 继续上抛
    console.error(`[actview] ${info} 阶段发生未捕获错误：`, err)
    return false
  } finally {
    resetTracking()
  }
}
