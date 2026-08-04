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

