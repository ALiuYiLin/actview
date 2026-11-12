// ============================================================
// 编译期类型测试（type-tests，不执行）：公开 JSX 作者层（第一版类组件）
//   - 类组件 props 推导 / 必填校验 / 未知属性拦截
//   - 事件参数与原生属性类型检查
//   - JSX.Element 只暴露 4 个稳定字段（无 VNode 内部字段）
//   - ClassComponent / ComponentProps 公开视图可用
// ============================================================

import type {
  ClassComponent,
  ComponentProps,
  Element,
} from '@actview/jsx'

type HelloProps = { name: string; onSave?: (value: string) => void }

class Hello {
  constructor(_props: HelloProps) {
    void _props
  }
  render() {
    return <div class="hello">hello</div>
  }
}

// ------------------------------------------------------------
// 1. JSX props 推导（类组件构造器）
// ------------------------------------------------------------
export const ok = <Hello name="x" onSave={(value) => value.toUpperCase()} />
// @ts-expect-error 缺少必填 prop name
export const missingProp = <Hello />
// @ts-expect-error name 必须是 string
export const wrongPropType = <Hello name={123} />
// @ts-expect-error 未声明的自定义属性应报错
export const unknownProp = <Hello name="x" unknownProp={1} />

// ------------------------------------------------------------
// 2. 公开元素契约：只有稳定字段
// ------------------------------------------------------------
const node = <div class="x" />
export const asElement: Element = node
export const elementType = node.type
export const elementKey = node.key
export const elementProps = node.props
export const elementRef = node.ref
// @ts-expect-error 公开元素不含 VNode 内部字段（$$typeof）
node.$$typeof
// @ts-expect-error 公开元素不含渲染器字段（el）
node.el
// @ts-expect-error 公开元素不含组件实例（component）
node.component

// ------------------------------------------------------------
// 3. ClassComponent / ComponentProps 公开视图
// ------------------------------------------------------------
declare const compiled: ClassComponent<HelloProps>
export const compiledAsComponentProps: ComponentProps<typeof compiled> = {
  name: 'x',
}
export const helloClass: ClassComponent<HelloProps> = Hello

// ------------------------------------------------------------
// 4. 原生元素属性 / 事件类型
// ------------------------------------------------------------
// @ts-expect-error onClick 参数是 MouseEvent，不是 number
const badEvent = <button onClick={(e: number) => e.toFixed()} />
// @ts-expect-error input type 有枚举约束
const badInput = <input type="nope" />
export const goodInput = <input type="text" value="v" />
export const goodEvent = <button onClick={(e) => e.target} />
export { badEvent, badInput }
