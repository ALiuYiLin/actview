import { createContext } from 'actview'

const ThemeContext = createContext('light')

export function App(props) {
  return (
    <ThemeContext.Provider value={props.theme}>
      <Child />
    </ThemeContext.Provider>
  )
}

function Child() {
  const theme = ThemeContext.use()
  return <p data-testid="theme">当前主题: {theme.value}</p>
}
