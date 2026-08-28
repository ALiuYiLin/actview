---
'@actview/core': minor
---

createContext 改为 store-as-is 存值语义（原样存储,不包 ref/不 watch 同步）

- **破坏性变更**:Provider 不再把 value 包一层内部 ref 并 watch props.value 同步。
  `use()` 返回注入表中【原样存储的值】,类型从 `Ref<T>` 改为 `T`。
- 动态值的新契约:把响应式的东西以稳定引用传入并在树中保持——
  `value={reactive 对象}` / `value={{ ref 字段 }}`（对象携带,顶层解包不深入）/
  `value={rawRef(ref本体)}`（绕过 jsxFactory 顶层解包）。
  消费端在 render 里读取这些响应式数据即自动收集依赖、随变化更新。
- ⚠️ 传值快照（如 `value={state.theme}`）= 注入静态值,后续变化不传播
  （重挂载的消费方读到的也是注入表当前值）。这是契约而非缺陷。
- 动机:旧实现的内部 ref+watch 是在为「传快照值」兜底,并曾引入真实缺陷
  （plantform-diff.md:383 combobox 惰性 computed 事故）;新契约回归
  Vue provide/inject 本源——「存响应式的东西,读的时候自动追踪」。
- 迁移:动态值消费方——Provider 改传稳定 reactive 对象/ref 本体,
  消费端直接读其属性/.value;静态值消费方无需改动。
- 类型强化:createContext 增加重载——【对象默认值强制 Reactive<T>】
  （reactive() 产物）,杜绝「字面量快照对象当默认值、后续变化不传播」;
  原始值/undefined 走宽松重载。注意:类型只能约束工厂默认值这一入口,
  Provider value 端的每次渲染字面量仍属运行期契约。
