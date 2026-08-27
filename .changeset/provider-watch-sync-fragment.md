---
'@actview/core': patch
---

createContext Provider：value prop 同步改 `flush: 'sync'` + render 返回值统一 Fragment 归一化

- value 变化的 watch 同步由默认 pre（微任务队列）改为 sync：消除「消费方因其他依赖先行入队、同轮读到旧 context 值」的撕裂窗口，对齐 React context 传播时机。
- Provider render 返回值显式包 Fragment：不依赖 mountComponent 对数组/裸值的隐式归一化，SSR/hydrate/renderer 全链路行为一致。
- 新增验收测试 test/context-ref-unwrap.test.tsx：覆盖 `<Provider value={ref}>` 自动解包后的「接力」响应性路径与对象深层修改的直达路径。
