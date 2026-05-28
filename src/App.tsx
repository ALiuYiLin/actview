import { Router, RouterView } from 'actview'
import {
  RefDemo,
  ReactiveDemo,
  ComputedDemo,
  WatchDemo,
  SlotDemo,
  KeyDiffDemo,
  BugsDemo,
} from './Demo'
import './app.css'

const navItems = [
  { path: '/ref',      label: 'ref' },
  { path: '/reactive', label: 'reactive' },
  { path: '/computed', label: 'computed' },
  { path: '/watch',    label: 'watch' },
  { path: '/slot',     label: 'Slot' },
  { path: '/keydiff',  label: 'Key Diff' },
  { path: '/bugs',     label: 'Bugs' },
]

const router = new Router({
  routes: [
    { path: '/', component: RefDemo },
    { path: '/ref', component: RefDemo },
    { path: '/reactive', component: ReactiveDemo },
    { path: '/computed', component: ComputedDemo },
    { path: '/watch', component: WatchDemo },
    { path: '/slot', component: SlotDemo },
    { path: '/keydiff', component: KeyDiffDemo },
    { path: '/bugs', component: BugsDemo },
  ],
})

export function App() {
  return () => {
    const currentPath = router.matched.value[0]?.path || '/'

    return (
      <div>
        <nav class="demo-nav">
          {navItems.map(item => (
            <a key={item.path}
              href={item.path}
              onClick={e => { e.preventDefault(); router.push(item.path) }}
              class={currentPath === item.path ? 'active' : ''}>
              {item.label}
            </a>
          ))}
        </nav>

        <RouterView />
      </div>
    )
  }
}
