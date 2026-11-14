import { ActViewComponent, Component, Ref } from 'actview'
import { useLangs } from '../composables/langs'
import { VPLink } from './VPLink'

@Component({ name: 'VPNavScreenTranslations' })
export class VPNavScreenTranslations extends ActViewComponent {
  @Ref
  isOpen = false

  render() {
    const { localeLinks, currentLang } = useLangs({ correspondingLink: true })
    if (!localeLinks.value.length || !currentLang.value.label) return null
    return (
      <div class={['VPNavScreenTranslations', this.isOpen ? 'open' : ''].join(' ')}>
        <button class="title" onClick={() => (this.isOpen = !this.isOpen)}>
          <span class="vpi-languages icon lang" />
          {currentLang.value.label}
          <span class="vpi-chevron-down icon chevron" />
        </button>
        <ul class="list">
          {localeLinks.value.map((locale: any) => (
            <li key={locale.link} class="item">
              <VPLink
                class="link"
                href={locale.link}
                external={false}
                lang={locale.lang}
                hreflang={locale.lang}
                rel="alternate"
                dir={locale.dir}
              >
                {locale.text}
              </VPLink>
            </li>
          ))}
        </ul>
      </div>
    )
  }
}