# Design

## vue 
- v-if
- v-show
- v-model
- v-for

react


组件声明，插槽暴露
```tsx
export const MyButton: ComponentDefinition = defineComponent({
  name: "MyButton",
  render: (props) => {
    const kls = ['btn', props.type ? `btn-${props.type}` : '', props.size ? `btn-${props.size}` : '', props.disabled !== undefined ? 'btn-disabled' : '', props.loading !== undefined ? 'btn-loading' : ''].filter(Boolean).join(' ');
    return (
      <div className={kls}>
        <slot name="before"></slot>
        <slot></slot>
        <slot name="after"></slot>
      </div>
    );
  },
});
```
在html中使用
```html
<MyButton type="primary">
    <template #before>
        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
        </svg>
    </template>
    添加
</MyButton>
```
组件注册后，将Mybutton 标签解析，并转化为以下DOM结构
```html
<div class="btn btn-primary">
    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"></path></svg>
    添加
</div>
```

组件注册
```tsx

// 导入并注册组件,需要再compile之间执行
import { MyButton, buttonCmp } from './components/button';

registerComponents([MyButton]);

// 解析页面中的自定义组件（在 DOM 解析完成后执行）
resolveComponents();
```

### 待解决问题
[ ] 自定义组件嵌套自定义组件样式失效




1、html load
2、custom components register
3、custom components resolve(use attr value)
4、custom components render
5、custom components mount
6、options create(use ref value)
7、options mount



一种结构固定的组件 模板渲染(通过option配置组件及组件内部的属性、事件等;view = f(option))
- 手动配置，然后代理到dom

一种结构可变的组件 render函数构造(view = f(state))
- 解析自定义标签
- 通过函数调用


parse html => 解析自定义标签
提取props、插槽、事件 => option
render => 生成DOM结构
模板与插槽合并 => 生成DOM结构
绑定事件 =》 合并DOM结构



1、一种是在html中声明组件（由core解析DOM，提取props（喊模板插槽slots），再调用组件render方法=》生成真实DOM）
2、一种是通过jsx工厂函数创建的组件（render方法，无需使用core处理，工厂函数会调组件render方法生成真实DOM）


这是一个很好的问题。以你目前的框架设计来看，没有办法自动分离 setup 和 render 阶段——让我解释为什么，以及主流框架是怎么做的。

当前框架的情况
你的 JSX 工厂中，函数组件的处理是这样的：

jsx.tsL110-L110
复制
插入
新建文件
保存
应用
return tag(mergedProps);  // 直接调用，一次性执行完毕
当 Button 被调用时：


const Button = () => {
  const a = ref(1)          // ← 这行和
  return <div>{a.value}</div> // ← 这行在同一次调用中一起执行
}
整个函数体一次性执行完毕，返回一个真实 DOM 元素。框架无法区分"哪些是 setup（只执行一次）"、"哪些是 render（需要反复执行）"。

主流框架如何实现 setup/render 分离
方案一：Vue 3 的 Composition API
Vue 3 通过约定返回值来分离：


// Vue 3
const Button = {
  setup() {
    const a = ref(1)          // setup 阶段：只执行一次
    return () => h('div', a.value)  // 返回的函数就是 render，可反复执行
  }
}
框架内部做的事：


const setupResult = component.setup()  // 执行一次 setup
// setupResult 是函数 → 当作 render 函数保存
renderFn = setupResult
// 后续响应式数据变化时只重新调用 renderFn()，不会重新调用 setup()
方案二：React 的 Hooks + Fiber
React 完全不分离——每次更新都重新执行整个函数体，但通过 hooks 的内部链表保持状态：


const Button = () => {
  const [a, setA] = useState(1)  // 首次：创建状态；后续：从链表中读取旧状态
  return <div>{a}</div>
}
React 能这样做是因为它有虚拟 DOM——每次执行只是创建轻量的 vNode 对象，不是真实 DOM。

方案三（适合你的框架）：约定 setup 返回 render 函数
这是最适合 ActView 的方式，因为你直接操作真实 DOM，需要明确区分"初始化"和"更新"：


const Button = (props) => {
  // ——— setup 阶段（只执行一次）———
  const count = ref(1)

  // ——— 返回 render 函数（数据变化时反复执行）———
  return () => <div>{count.value}</div>
}
框架侧需要改造的核心逻辑：


// jsx.ts 中处理函数组件时
if (typeof tag === "function") {
  const result = tag(mergedProps)

  if (typeof result === "function") {
    // ★ 返回值是函数 → setup/render 模式
    // result 就是 render 函数，后续响应式更新只重新调用 result()
    // setup 阶段（tag 函数体）不会再被执行
    return result()  // 首次渲染调用一次 render
  } else {
    // 返回值是 DOM → 传统的无状态组件（当前行为）
    return result
  }
}
然后在编译侧，当检测到组件返回的是 render 函数时，需要为它创建独立的 updateFn，用锚点追踪它的 DOM 位置，数据变化时只重新调用这个 render 函数。

这就是你在上一个问题中遇到的根本问题——Home() 里的 reactive 状态每次都被重新初始化，正是因为框架没有 setup/render 分离机制，每次更新都重新调用了整个 Home()。
