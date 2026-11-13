# playground/actview

私有示例应用（不发布），用于验证运行时和 DevTools 扩展。

## 开发

```bash
pnpm dev
# http://127.0.0.1:3000
```

非 production 模式下自动安装 `@actview/devtools`：

```ts
if (import.meta.env.MODE !== 'production') {
  app.use(devtoolsPlugin, {
    appName: 'ActView Playground',
    bridge: true,
    performance: true,
  })
}
```

## DevTools 扩展测试

1. Chrome 打开 `chrome://extensions`，开启开发者模式；
2. 加载 `extensions/devtools`；
3. 打开 `http://127.0.0.1:3000`；
4. 打开 DevTools → ActView 面板。

可验证：

- Components：App、Counter、`CounterData` Model；
- 点击按钮更新 `CounterData.count`；
- Events：mount / update / track / trigger；
- Performance：mount / update 耗时；
- Pick element：选择按钮反查 Counter；
- 高亮 / clear highlight。
