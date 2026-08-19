# context-basic — createContext 跨层级共享状态

**难度**：medium ｜ **标签**：context / component

## 题目

用框架的 `createContext` 实现主题透传：

```
createContext('light') → ThemeContext
App(props) 用 <ThemeContext.Provider value={props.theme}> 提供主题
Child 用 ThemeContext.use() 消费 → 渲染 <p data-testid="theme">当前主题: {theme}</p>
```

要求：

- `ThemeContext` 默认值为 `'light'`
- `App` 通过 Provider 把 `props.theme` 提供给子孙组件
- 子组件用 `use()` 读取（返回 ref），渲染当前主题
- **App 的 theme prop 更新后，消费方视图同步更新**

## 掌握点

- `createContext(defaultValue)` → `{ Provider, use() }`
- `use()` 返回 ref；Provider 的 value 变化会同步到消费方
- 对比 React：这是 ActView 的 context 形态（Provider 组件 + use hook）

## 模板

见 `solution.tsx`，补全组件即可。

## 运行

```bash
pnpm challenge run context-basic
```
