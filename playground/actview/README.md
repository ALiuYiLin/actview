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

## Tailwind CSS

Playground 使用 **Tailwind CSS v4 + `@tailwindcss/vite`**：

```ts
// vite.config.ts
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()],
})
```

```css
/* src/styles.css */
@import "tailwindcss";
```

`src/main.ts` 引入 `./styles.css`；样式类直接写在 ActView JSX 的 `class` 上：

```tsx
<button class="rounded-xl bg-indigo-600 px-6 py-3 text-white">
  +1
</button>
```

`@tailwindcss/vite` 是 Vite 层插件，不依赖 React/Vue 等具体框架；它只处理 Vite 的 CSS 管线并扫描源码中的 class。ActView 保持原生 JSX/DOM 属性语义，所以不需要额外框架适配。

