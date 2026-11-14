import { ActViewComponent, Component } from 'actview'
import { useData } from '../composables/data'
import { useLangs } from '../composables/langs'
import { VPFlyout } from './VPFlyout'
import { VPMenuLink } from './VPMenuLink'
import '../extract-css/VPNavBarTranslations.scoped.css'
@Component({ name: 'VPNavBarTranslations' })
export class VPNavBarTranslations extends ActViewComponent {
  render() {
    const { theme } = useData()
    const { localeLinks, currentLang } = useLangs({ correspondingLink: true })
    if (!localeLinks.value.length || !currentLang.value.label) return null
    return (
      <VPFlyout
        class="VPNavBarTranslations"
        icon="vpi-languages"
        label={theme.value.langMenuLabel || 'Change language'}
      >
        <div class="items">
          <p class="title">{currentLang.value.label}</p>
          {localeLinks.value.map((locale: any) => (
            <VPMenuLink
              key={locale.link}
              item={locale}
              external={false}
              lang={locale.lang}
              hreflang={locale.lang}
              rel="alternate"
              dir={locale.dir}
            />
          ))}
        </div>
      </VPFlyout>
    )
  }
}