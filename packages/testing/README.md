# @actview/testing

ActView 组件测试工具（对齐 testing-library，TSX 风格）。配合 vitest + happy-dom 使用。

## 安装

```bash
pnpm add -D @actview/testing
```

## 快速开始

```tsx
import { render, fireEvent, waitFor, screen, cleanup } from '@actview/testing'
import { reactive } from 'actview'

afterEach(cleanup)

function Counter() {
  const state = reactive({ count: 0 })
  return (
    <button class="btn" onClick={() => state.count++}>
      count: {state.count}
    </button>
  )
}

it('点击按钮计数 +1', async () => {
  const { getByClass, getByText } = render(() => <Counter />)
  expect(getByText('count: 0')).not.toBeNull()

  fireEvent(getByClass('btn'), 'click')
  await waitFor(() => expect(getByText('count: 1')).not.toBeNull())
})
```

## API

| 导出 | 说明 |
|---|---|
| `render(component, options?)` | 挂载组件，返回容器 + 查询辅助 |
| `fireEvent(el, event, options?)` | 触发 DOM 事件（`value` 选项设置 input 值） |
| `waitFor(cb, options?)` | 轮询执行断言直到通过或超时 |
| `screen` | 全局查询（作用于最近 render 的 container） |
| `cleanup()` | 卸载全部 render 的组件 |

### 查询辅助

| 方法 | 说明 |
|---|---|
| `getByText` / `queryByText` | 文本匹配（get 找不到抛错，query 返回 null） |
| `getAllByText` / `queryAllByText` | 全部文本匹配 |
| `getByClass` / `queryByClass` | class 选择器 |
| `getByTestId` / `queryByTestId` | `data-testid` 属性 |
