import '../extract-css/VPDocFooterLastUpdated.css?scoped'
import { ActViewComponent, Component } from 'actview'
import { useData } from '../composables/data'

export class VPDocFooterLastUpdated extends ActViewComponent {
  render() {
    const { theme, page, lang } = useData()
    const timestamp = page.value.lastUpdated
    const date = timestamp ? new Date(timestamp) : null
    const datetime = date
      ? new Intl.DateTimeFormat(lang.value || 'en', {
          dateStyle: 'medium',
          timeStyle: 'medium',
        }).format(date)
      : ''
    return (
      <p class="VPLastUpdated">
        {theme.value.lastUpdated?.text ||
          theme.value.lastUpdatedText ||
          'Last updated'}
        :{' '}
        <time datetime={date ? date.toISOString() : ''}>{datetime}</time>
      </p>
    )
  }
}

Component({ name: 'VPDocFooterLastUpdated' })(VPDocFooterLastUpdated)
