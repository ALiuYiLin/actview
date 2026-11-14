import { ActViewComponent, Component } from 'actview'
import { useData } from './composables/data'
import '../extract-css/NotFound.scoped.css'
@Component({ name: 'NotFound' })
export class NotFound extends ActViewComponent {
  render() {
    const { theme } = useData()
    return (
      <div class="NotFound">
        <p class="code">404</p>
        <h1 class="title">PAGE NOT FOUND</h1>
        <div class="divider" />
        <blockquote class="quote">
          But if you don't change your direction, and if you keep looking,
          you may end up where you are heading.
        </blockquote>
        <div class="action">
          <a class="link" href={theme.value.notFoundLink ?? '/'}>
            {theme.value.notFoundLinkLabel ?? 'Take me home'}
          </a>
        </div>
      </div>
    )
  }
}
