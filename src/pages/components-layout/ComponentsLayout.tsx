import { RouterView } from '@actview/router'

export function ComponentsLayout() {
  return () => (
    <div class="components-layout">
      <h1>component</h1>
      <RouterView />
    </div>
  )
}
