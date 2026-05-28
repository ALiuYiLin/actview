import { ref } from "actview"
import {
  RefDemo,
  ReactiveDemo,
  ComputedDemo,
  WatchDemo,
  SlotDemo,
  KeyDiffDemo,
} from "./Demo"

type Demo = 'ref' | 'reactive' | 'computed' | 'watch' | 'slot' | 'keydiff'

const demoList: { key: Demo; label: string }[] = [
  { key: 'ref',      label: 'ref' },
  { key: 'reactive', label: 'reactive' },
  { key: 'computed', label: 'computed' },
  { key: 'watch',    label: 'watch' },
  { key: 'slot',     label: 'Slot' },
  { key: 'keydiff',  label: 'Key Diff' },
]

export function App() {
  const current = ref<Demo>('ref')

  const demo = () => {
    switch (current.value) {
      case 'ref':      return <RefDemo />
      case 'reactive': return <ReactiveDemo />
      case 'computed': return <ComputedDemo />
      case 'watch':    return <WatchDemo />
      case 'slot':     return <SlotDemo />
      case 'keydiff':  return <KeyDiffDemo />
    }
  }

  return () => (
    <div>
      <nav style="padding:8px;border-bottom:1px solid #ccc;margin-bottom:16px">
        {demoList.map(d => (
          <button key={d.key} onClick={() => current.value = d.key}
            style={current.value === d.key ? 'font-weight:bold;background:#e0e0e0' : ''}>
            {d.label}
          </button>
        ))}
      </nav>

      {demo()}
    </div>
  )
}
