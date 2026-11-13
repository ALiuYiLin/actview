// ============================================================
// @actview/core — 组件内 Model（@Model / @UseModel）
//
// @Model：标记组件内数据层类；per-component-instance 单实例，不参与 render。
// @UseModel(Token)：在组件 / Model 中声明“使用该 Model 的单实例”。
// 生命周期复用组件的装饰器（@Setup/@Mounted/...），不新增 @Init/@Dispose。
// ============================================================

import { MODEL_MARKER } from '../types/component'
import {
  META_KEY,
  mergeMeta,
  metaOf,
  ownMeta,
  type ComponentMeta,
  type ModelToken,
} from './meta'

/**
 * @Model 类装饰器：标记组件内可注入数据类。
 *
 * 约束：
 * - 不能实现 render()（不参与渲染）；
 * - 支持 @Prop（owner 赋值）/@Provide（跨组件共享）与 async @Setup；
 * - @Setup('pre'|'after') 相对 owner 组件 setup；带 @Prop 默认 after；
 * - 通过 @UseModel(Token) 注入；生命周期与 owner 组件一致。
 */
export function Model<T extends Function>(target: T): T {
  if (
    typeof (target as unknown as { prototype?: { render?: unknown } })
      .prototype?.render === 'function'
  ) {
    throw new Error(
      `[actview] @Model 类 "${target.name || 'Anonymous'}" 不能实现 render()；` +
        '渲染组件请使用 @Component',
    )
  }

  const own = ownMeta(target)
  own.name = own.name ?? target.name

  const parentCtor = Object.getPrototypeOf(target) as Function | null
  const parentMeta = parentCtor?.[META_KEY as keyof Function] as
    | ComponentMeta
    | undefined
  const merged = mergeMeta(parentMeta, own)

  Object.defineProperty(target, META_KEY, {
    value: merged,
    configurable: true,
    writable: false,
    enumerable: false,
  })
  Object.defineProperty(target, MODEL_MARKER, {
    value: true,
    configurable: true,
    writable: false,
    enumerable: false,
  })
  return target
}

/**
 * @UseModel(Token) 属性装饰器：从当前组件 scope 解析 Model 单实例。
 *
 * 显式 token 是必需的：TS 类型在运行时被擦除，esbuild 不生成 design:type。
 */
export function UseModel(token: ModelToken): PropertyDecorator {
  if (typeof token !== 'function') {
    throw new Error(`[actview] @UseModel 需要一个 Model 类 token（当前为 ${typeof token}）`)
  }
  return (target: object, propertyKey: string | symbol): void => {
    metaOf(target).models.set(String(propertyKey), token)
  }
}
