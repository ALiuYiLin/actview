// ============================================================
// 调度器 — 组件级微任务批处理（docs/renderer.md）
//
//   主队列（queue）：组件更新 job，按 id 升序执行（父组件 uid 小 → 先更新）
//   post 队列：mounted / updated / ref 等，整轮 patch 结束后按入队顺序执行
//
//   M1 语义：
//   - queueJob：同一 tick 内同 job 去重；按 id 升序（无 id 视为 Infinity）
//   - queuePostFlushCb：一轮 flush 结束（DOM 就绪）后执行；不按 id 排序，
//     保证子组件的 mounted 先于父组件
//   - nextTick：返回当前 flush 的 Promise；无 pending flush 时 Promise.resolve()
//   - 错误不吞：flush 期间第一个错误在状态复位后抛出（其余 job 仍会执行，
//     保证调度器不会卡死）
// ============================================================

import type { SchedulerJob } from './instance'

/** 主任务队列：执行期间保留已执行项，用 flushIndex 指针推进 */
const queue: SchedulerJob[] = []

/** 当前正在执行的 job 在 queue 中的下标；-1 表示不在 flush 循环内 */
let flushIndex = -1

/** post flush 回调队列（按入队顺序，不排序） */
const pendingPostFlushCbs: SchedulerJob[] = []

let isFlushing = false
let isFlushPending = false

/** 当前这轮 flush 的 Promise；nextTick 的等待目标 */
let currentFlushPromise: Promise<void> | null = null

const getId = (job: SchedulerJob): number =>
  job.id == null ? Infinity : job.id

/**
 * 二分查找插入位置：id 升序、相同 id 保持入队先后（稳定）。
 * flush 执行期间只在「尚未执行」的区间插入，避免插到已执行的项前面被跳过。
 */
function findInsertionIndex(id: number): number {
  let start = isFlushing && flushIndex >= 0 ? flushIndex + 1 : 0
  let end = queue.length
  if (start > end) start = end
  while (start < end) {
    const middle = (start + end) >>> 1
    if (getId(queue[middle]) <= id) {
      start = middle + 1
    } else {
      end = middle
    }
  }
  return start
}

/** 调度一轮 flush（微任务；已在 flush 中 / 已排队时不重复） */
function queueFlush(): void {
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true
    currentFlushPromise = Promise.resolve().then(flushJobs)
  }
}

/**
 * 入队一个组件更新任务。
 * - 同 job 去重（flush 期间从「尚未执行」区间找，当前正在执行的 job 不会被重复入队，
 *   除非 job.allowRecurse）
 * - 按 id 升序（父先子后）
 */
export function queueJob(job: SchedulerJob): void {
  if (!queue.length) {
    queue.push(job)
  } else {
    // flush 中查重从当前 job 的位置开始：正在执行的 job 视为「已在队列」，
    // 因此 render 期间自触发会去重；allowRecurse 时从下一个位置开始找，允许再入队。
    const searchFrom =
      isFlushing && flushIndex >= 0
        ? job.allowRecurse
          ? flushIndex + 1
          : flushIndex
        : Math.max(flushIndex, 0)
    if (!queue.includes(job, searchFrom)) {
      if (job.id == null) {
        queue.push(job)
      } else {
        queue.splice(findInsertionIndex(job.id), 0, job)
      }
    }
  }
  queueFlush()
}

/**
 * 入队一个 post flush 回调（mounted / updated / ref 等）。
 * 普通函数包成 { run } 任务；执行顺序 = 入队顺序。
 */
export function queuePostFlushCb(cb: SchedulerJob | (() => void)): void {
  pendingPostFlushCbs.push(typeof cb === 'function' ? { run: cb } : cb)
  queueFlush()
}

/**
 * 执行 post flush 队列（整轮 patch 完成后）。
 * 先取快照再清空：执行期间新入队的 post cb 留到下一轮；按入队顺序执行。
 * 某个回调抛错不影响其余回调执行，第一个错误在该轮结束后抛出。
 */
export function flushPostFlushCbs(): void {
  if (pendingPostFlushCbs.length === 0) return

  const cbs = pendingPostFlushCbs.slice()
  pendingPostFlushCbs.length = 0

  let error: unknown
  let hasError = false

  for (const cb of cbs) {
    // 已失效的回调（如组件卸载后）跳过
    if (cb.active === false) continue
    try {
      cb.run()
    } catch (err) {
      if (!hasError) {
        hasError = true
        error = err
      }
    }
  }

  if (hasError) throw error
}

/** flush 主流程：先跑组件更新队列（允许执行中再入队），最后跑 post cbs */
function flushJobs(): void {
  isFlushPending = false
  isFlushing = true

  let error: unknown
  let hasError = false

  const captureError = (err: unknown): void => {
    if (!hasError) {
      hasError = true
      error = err
    }
  }

  try {
    // 用下标遍历：flush 期间新入队的 job 会插到 flushIndex 之后并被本轮执行
    for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
      const job = queue[flushIndex]
      // 组件卸载后 job.active = false → 跳过
      if (!job || job.active === false) continue
      try {
        job.run()
      } catch (err) {
        captureError(err)
      }
    }
  } finally {
    // 状态复位：即使中途抛错也要恢复，后续 queueJob / nextTick 仍正常工作
    flushIndex = -1
    queue.length = 0

    try {
      flushPostFlushCbs()
    } catch (err) {
      captureError(err)
    }

    isFlushing = false
    currentFlushPromise = null

    // post cbs 中可能又入队了 job / post cb → 再排一轮微任务
    if (queue.length || pendingPostFlushCbs.length) {
      queueFlush()
    }
  }

  if (hasError) throw error
}

/**
 * 等待当前 flush 完成；可选回调在 flush 后执行。
 * 无 pending flush 时以 Promise.resolve() 为基准。
 */
export function nextTick<T = void>(fn?: () => T): Promise<T> {
  const p = currentFlushPromise ?? Promise.resolve()
  return (fn ? p.then(fn) : p) as Promise<T>
}
