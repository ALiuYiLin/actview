import { ref } from 'actview';
import './index.css?scoped'

export function App(props: {name?: string}) {
  const count = ref(1)
  return (
    <div class="app">
      <button>{count}</button>
      <h1>{props?.name}</h1>
    </div>
  );
}
