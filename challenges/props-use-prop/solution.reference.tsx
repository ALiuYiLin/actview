import { useProps } from 'actview'

export function Counter(props) {
  const { count } = useProps(props, { count: (v) => v ?? 0 })
  return <p data-testid="count">count: {count.value}</p>
}
