# 双 ref 组件与 ref 形 props 惯用法（案例）

> 场景：组件同时暴露两个 ref——一个绑定**根元素**（`props.ref`），一个绑定**根下的 input DOM**（`props.inputRef`）。
> 本文记录：jsxFactory 的 props 解包机制、`toRefs` 双重解包陷阱的根因、标准解法（**toRefs 管值形，`props.X` 直读管 ref 形**）与反模式。
> 真实参照：`src/components/checkbox/CheckboxRoot.tsx`（四方 ref 合并）、`src/components/avatar/root/AvatarRoot.tsx`（ref 形 props 排除注释）。
> 关联：[react-migration.md](./react-migration.md)（整体迁移 + Context 案例）、[headless-components.md](./headless-components.md)（无头组件 ref 契约）。

---

## 一、目标形态

```tsx
<Field ref={rootRef} inputRef={rawRef(inputRef)} />
// 挂载后：rootRef.value = 根 <div>（经组件转发）；inputRef.value = <input>
```

- 根 ref：`<Comp ref={x}/>` 的 x 是**组件实例（设计语义）**；组件内部把 `props.ref` 绑到根元素后，父拿到根 DOM。
- input ref：组件内部绑定到 input 元素；需要时与组件自持 ref 合并。

---

## 二、机制：jsxFactory 的 props 顶层自动解包（`ref` 键是唯一例外）

`packages/jsx/src/jsxFactory.ts` 的 `unwrapProps`：

```ts
function unwrapProps(props: any): any {
  for (const k in props) {
    if (k === 'ref') continue                        // ← ref 键排除：模板引用语义，不解包
    const v = props[k]
    if (isRef(v) && !v.__av_raw) out[k] = v.value    // 其余顶层 ref → 读 .value 传快照
  }
  return out ?? props
}
```

- `ref={rootRef}`：原样进 `props.ref`（ref 键不解包）。
- `inputRef={inputRef}`（自定义名）：被顶层解包成 `.value` 快照（初始 `null`）——**必须 `rawRef()` 包裹**。

### rawRef 逃逸口（`packages/core/src/reactivity/ref.ts`）

```ts
export function rawRef<T>(ref: Ref<T>): Ref<T> {
  return {
    __v_isRef: true,
    __av_raw: true,                    // jsxFactory 见此标记跳过解包
    get value() { return ref.value },
    set value(v) { ref.value = v },    // 组件内写 .value 委托回原 ref
  } as Ref<T>
}
```

- 组件收到 ref 对象**本体**；组件内写 `.value` 直达父组件的原始 ref。
- renderer `applyRef` 语义：挂载写 `.value` / 调用函数 ref，卸载自动置 `null`。

---

## 三、完整示例

```tsx
// ---------- 父组件（使用侧） ----------
import { ref, rawRef } from 'actview'

function Demo() {
  const rootRef = ref<HTMLDivElement | null>(null)     // 根元素
  const inputRef = ref<HTMLInputElement | null>(null)  // input DOM

  return (
    <>
      {/* ⚠️ 自定义名 ref 形 prop 必须 rawRef() 包裹——否则被顶层解包成 null 快照 */}
      {/* ref 属性本身不被解包（unwrapProps 排除 ref 键），直达 props.ref */}
      <Field ref={rootRef} inputRef={rawRef(inputRef)} />
      <button onClick={() => inputRef.value?.focus()}>聚焦 input</button>
    </>
  )
}

// ---------- 子组件（两个 ref 的绑定） ----------
import { ref, computed, toRefs, type Ref } from 'actview'
import { useMergedRefs } from '../internals/useMergedRefs'

interface FieldProps {
  ref?: Ref<HTMLDivElement | null>            // 根元素引用（ref 键不解包，直达 props.ref）
  inputRef?: Ref<HTMLInputElement | null>     // input 引用（父侧经 rawRef() 传入）
  [key: string]: any
}

export function Field(props: FieldProps) {
  // ① toRefs 只解构【值形 props】；ref 形（ref/inputRef）不进来（见第四节陷阱）
  const { className, style, ...elementRefs } = toRefs(props) as Record<string, Ref<any>>

  // ② rest 转发时剔除 ref 形键（toRefs 枚举所有 key，ref 形键仍会混在 elementRefs 里）
  const EXCLUDE = new Set(['ref', 'inputRef', 'className', 'style', 'children'])
  const elementProps = computed<Record<string, any>>(() => {
    const out: Record<string, any> = {}
    for (const k in elementRefs) {
      if (EXCLUDE.has(k)) continue
      out[k] = elementRefs[k].value           // 值形 props：渲染期 .value 活引用
    }
    return out
  })

  // ③ ref 形 props 直读本体 + 组件内部自持 ref 合并
  const internalInput = ref<HTMLInputElement | null>(null)
  const mergedInputRef = useMergedRefs(props.inputRef, internalInput)

  return (
    <div ref={props.ref}>                     {/* 根：props.ref 本体直传 */}
      <input ref={mergedInputRef} {...elementProps.value} />
    </div>
  )
}
```

组件自己**不需要**操作 input 时，合并可省：`<input ref={props.inputRef} />` 直接绑。
根元素走 `useRenderElement` 时：`params.ref: props.ref` 对象本体直传（内部 useMergedRefs 合并挂到渲染元素）——`AvatarRoot`/`CheckboxRoot` 即此写法。

---

## 四、陷阱：ref 形 props 进 toRefs 会双重解包

根因：`toRef` 的 **ref 透传**（`packages/core/src/reactivity/ref.ts`）：

```ts
export function toRef(object, key) {
  const val = object[key]
  if (isRef(val)) return val            // ← 槽位值是 ref：返回 ref 本体（而非槽位活引用）
  return new ObjectRefImpl(object, key)
}
```

对 ref 形 props 做 `toRefs` 解构，结果**取决于 setup 瞬间槽位的状态**（二义性）：

| setup 瞬间槽位 | toRefs 解构结果 | 后果 |
|---|---|---|
| 已是 ref 对象（父经 rawRef 传入） | 透传返回 ref 本体 | `.value` 直接是 **DOM 当前值/null**（双重解包）；把 `.value` 当"ref 对象"继续传/链式调用的代码全错 |
| undefined（可选 prop 未传） | `ObjectRefImpl`（指向槽位） | 绑到元素后 applyRef 把 DOM **写进 props 槽位**——覆盖父后来传入的 ref 对象，父侧**静默断链**、props 被污染 |

同一种写法两种行为、靠 setup 快照决定 → **ref 形 props 必须绕开 toRefs，直读 `props.X` 本体**。

---

## 五、速查

| 场景 | 写法 |
|---|---|
| 父传根 ref | `<Field ref={rootRef} />`（ref 键不解包，直达 props.ref） |
| 父传 input ref | `<Field inputRef={rawRef(inputRef)} />`（自定义名必须 rawRef） |
| 子绑根元素 | `<div ref={props.ref} />` 或 `useRenderElement` 的 `params.ref` |
| 子绑 input（含内部使用） | `useMergedRefs(props.inputRef, internalInput)` → `<input ref={merged} />` |
| 值形 props 解构 | `toRefs(props)` / `useProps`（活引用） |
| ref 形 props | **直读 `props.X` 本体**，禁入 toRefs/useProps 解构 |
| rest 转发 | toRefs 之后用 EXCLUDE 集合剔除 ref 形键 |

---

## 六、变体与反模式

```tsx
// ✅ 变体 A：只需少数几个键时——精确 toRef，无 rest 污染；ref 形照样 props.X 直读
const className = toRef(props, 'className')
const disabled  = toRef(props, 'disabled')

// ✅ 变体 B：键多且有默认值/转换——useProps（声明键返回 ComputedRef 活引用 + rest 聚合）
const { variant, size, rest } = useProps({
  variant: (v) => v ?? 'default',
  size: undefined,            // undefined = 裸透传原值
})
// ref 形键不声明进 map，直读 props；转发 rest 时同样剔除 ref 形键

// ❌ 反模式：先剔除再 toRefs——rest 是普通对象快照，父组件后续更新 props 不会进入
//    rest，toRefs(rest) 全部冻结。剔除必须发生在 toRefs 之后（EXCLUDE 过滤转发集合）
const { ref: _r, inputRef: _ir, ...rest } = props
const refs = toRefs(rest)
```
