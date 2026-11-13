;(() => {
  'use strict'

  const PAGE_SOURCE = 'actview-devtools-page'
  const PANEL_SOURCE = 'actview-devtools-panel'
  const tabId = chrome.devtools.inspectedWindow.tabId

  const state = {
    connected: false,
    apps: [],
    components: [],
    events: [],
    performance: [],
    appId: null,
    selectedId: null,
    selectedState: null,
    tab: 'components',
    paused: false,
  }

  const $ = (id) => document.getElementById(id)
  const statusEl = $('status')
  const appSelect = $('app-select')
  const treeEl = $('tree')
  const detailsEl = $('details')
  const eventsEl = $('events')
  const performanceEl = $('performance')
  const pauseBtn = $('pause')

  let reconnectTimer = null

  function send(type, payload) {
    chrome.tabs.sendMessage(
      tabId,
      { source: PANEL_SOURCE, type, payload },
      () => {
        if (chrome.runtime.lastError) {
          setConnected(false)
        }
      },
    )
  }

  function setConnected(connected) {
    state.connected = connected
    statusEl.textContent = connected ? 'connected' : 'disconnected'
    statusEl.className = `status ${connected ? 'connected' : 'disconnected'}`
  }

  function requestState() {
    if (state.selectedId == null) return
    send('getState', { id: state.selectedId })
  }

  function selectComponent(id) {
    state.selectedId = id
    state.selectedState = null
    renderTree()
    renderDetails()
    requestState()
    send('highlight', { id })
  }

  function applySnapshot(payload) {
    setConnected(true)
    state.apps = Array.isArray(payload.apps) ? payload.apps : []
    state.components = Array.isArray(payload.components)
      ? payload.components
      : []
    state.performance = Array.isArray(payload.performance)
      ? payload.performance
      : []
    if (!state.paused) {
      state.events = Array.isArray(payload.events) ? payload.events : []
    }

    if (state.appId == null && state.apps.length > 0) {
      state.appId = state.apps[0].id
    }
    if (state.appId != null && !state.apps.some((app) => app.id === state.appId)) {
      state.appId = state.apps[0]?.id ?? null
    }

    if (
      state.selectedId != null &&
      !state.components.some((component) => component.id === state.selectedId)
    ) {
      state.selectedId = null
      state.selectedState = null
      send('clearHighlight')
    }

    renderApps()
    renderTree()
    renderDetails()
    renderEvents()
    renderPerformance()
    if (state.selectedId != null) requestState()
  }

  function renderApps() {
    const current = state.appId
    appSelect.textContent = ''
    for (const app of state.apps) {
      const option = document.createElement('option')
      option.value = String(app.id)
      option.textContent = app.name || `App ${app.id}`
      appSelect.appendChild(option)
    }
    if (state.apps.length === 0) {
      const option = document.createElement('option')
      option.value = ''
      option.textContent = 'no app'
      appSelect.appendChild(option)
    }
    appSelect.value = current == null ? '' : String(current)
  }

  function componentById(id) {
    return state.components.find((component) => component.id === id) || null
  }

  function visibleComponents() {
    if (state.appId == null) return []
    return state.components.filter((component) => component.appId === state.appId)
  }

  function renderTree() {
    treeEl.textContent = ''
    const components = visibleComponents()
    if (components.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'tree-empty'
      empty.textContent = state.connected
        ? 'No components captured.'
        : 'Waiting for @actview/devtools…'
      treeEl.appendChild(empty)
      return
    }

    const ids = new Set(components.map((component) => component.id))
    const roots = components.filter(
      (component) =>
        component.parentId == null || !ids.has(component.parentId),
    )
    const rendered = new Set()

    const walk = (component, depth) => {
      if (!component || rendered.has(component.id)) return
      rendered.add(component.id)
      const children = components.filter(
        (child) => child.parentId === component.id,
      )
      const row = document.createElement('div')
      row.className = `tree-node${component.id === state.selectedId ? ' selected' : ''}`
      row.style.paddingLeft = `${10 + depth * 14}px`

      const caret = document.createElement('span')
      caret.className = 'caret'
      caret.textContent = children.length > 0 ? '▾' : '·'
      row.appendChild(caret)

      const name = document.createElement('span')
      name.className = 'name'
      name.textContent = component.name || 'Anonymous'
      row.appendChild(name)

      const badge = document.createElement('span')
      badge.className = 'badge'
      badge.textContent = String(component.renderCount ?? 0)
      badge.title = 'render count'
      row.appendChild(badge)

      row.addEventListener('click', () => selectComponent(component.id))
      treeEl.appendChild(row)

      for (const child of children) walk(child, depth + 1)
    }

    for (const root of roots) walk(root, 0)
  }

  function renderDetails() {
    const component = state.selectedId == null
      ? null
      : componentById(state.selectedId)

    if (!component) {
      detailsEl.className = 'details empty'
      detailsEl.textContent = 'Select a component from the tree.'
      return
    }

    detailsEl.className = 'details'
    detailsEl.textContent = ''

    const title = document.createElement('h2')
    title.textContent = component.name || 'Anonymous'
    detailsEl.appendChild(title)

    const meta = document.createElement('div')
    meta.className = 'meta'
    meta.textContent = `id ${component.id} · app ${component.appId} · renders ${component.renderCount} · ${component.elTag || 'no host'}${component.elId ? `#${component.elId}` : ''}`
    detailsEl.appendChild(meta)

    if (!state.selectedState) {
      const loading = document.createElement('div')
      loading.className = 'panel-hint'
      loading.textContent = 'Loading state…'
      detailsEl.appendChild(loading)
      return
    }

    const data = state.selectedState
    addSection('Props', data.props)
    addSection('State', data.state)
    addSection('Computed', data.computed)

    const modelTitle = document.createElement('div')
    modelTitle.className = 'section-title'
    modelTitle.textContent = `Models (${data.models?.length ?? 0})`
    detailsEl.appendChild(modelTitle)

    if (!data.models || data.models.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'panel-hint'
      empty.textContent = 'No @Model in this component.'
      detailsEl.appendChild(empty)
    } else {
      for (const model of data.models) {
        const box = document.createElement('div')
        box.className = 'model'
        const head = document.createElement('div')
        head.className = 'model-head'
        head.textContent = model.token
        box.appendChild(head)
        const value = document.createElement('pre')
        value.className = 'value'
        value.textContent = formatValue({
          state: model.state,
          computed: model.computed,
        })
        box.appendChild(value)
        detailsEl.appendChild(box)
      }
    }
  }

  function addSection(titleText, value) {
    const title = document.createElement('div')
    title.className = 'section-title'
    title.textContent = titleText
    detailsEl.appendChild(title)
    const pre = document.createElement('pre')
    pre.className = 'value'
    pre.textContent = formatValue(value)
    detailsEl.appendChild(pre)
  }

  function renderEvents() {
    eventsEl.textContent = ''
    const events = state.events.slice(-200).reverse()
    if (events.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'tree-empty'
      empty.textContent = 'No events yet.'
      eventsEl.appendChild(empty)
      return
    }

    const table = document.createElement('table')
    table.appendChild(
      tableHeader(['time', 'type', 'component', 'key']),
    )
    const body = document.createElement('tbody')
    for (const event of events) {
      const tr = document.createElement('tr')
      const payload = event.payload || {}
      addCell(tr, new Date(event.timestamp).toLocaleTimeString())
      const typeCell = document.createElement('td')
      typeCell.textContent = event.type
      typeCell.className = `event-${event.type}`
      tr.appendChild(typeCell)
      addCell(tr, event.name || (event.componentId != null ? `#${event.componentId}` : '—'))
      addCell(tr, payload.key == null ? '—' : String(payload.key))
      body.appendChild(tr)
    }
    table.appendChild(body)
    eventsEl.appendChild(table)
  }

  function renderPerformance() {
    performanceEl.textContent = ''
    const records = state.performance
      .slice()
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 200)
    if (records.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'tree-empty'
      empty.textContent = 'No performance records. Set app.config.performance = true.'
      performanceEl.appendChild(empty)
      return
    }

    const table = document.createElement('table')
    table.appendChild(tableHeader(['component', 'kind', 'duration', 'renders']))
    const body = document.createElement('tbody')
    for (const record of records) {
      const tr = document.createElement('tr')
      addCell(tr, record.name || `#${record.componentId}`)
      addCell(tr, record.kind)
      addCell(tr, `${record.duration.toFixed(2)} ms`)
      addCell(tr, String(record.renderCount))
      body.appendChild(tr)
    }
    table.appendChild(body)
    performanceEl.appendChild(table)
  }

  function tableHeader(columns) {
    const thead = document.createElement('thead')
    const tr = document.createElement('tr')
    for (const column of columns) {
      const th = document.createElement('th')
      th.textContent = column
      tr.appendChild(th)
    }
    thead.appendChild(tr)
    return thead
  }

  function addCell(tr, text) {
    const td = document.createElement('td')
    td.textContent = text
    tr.appendChild(td)
    return td
  }

  function formatValue(value) {
    if (value === undefined) return 'undefined'
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }

  function switchTab(tab) {
    state.tab = tab
    for (const button of document.querySelectorAll('.tab[data-tab]')) {
      button.classList.toggle('active', button.dataset.tab === tab)
    }
    $('tab-components').classList.toggle('hidden', tab !== 'components')
    $('tab-events').classList.toggle('hidden', tab !== 'events')
    $('tab-performance').classList.toggle('hidden', tab !== 'performance')
  }

  appSelect.addEventListener('change', () => {
    const value = Number(appSelect.value)
    state.appId = Number.isFinite(value) ? value : null
    state.selectedId = null
    state.selectedState = null
    send('clearHighlight')
    renderTree()
    renderDetails()
  })

  $('refresh').addEventListener('click', () => send('refresh'))
  $('pick').addEventListener('click', () => {
    statusEl.textContent = 'picking element…'
    send('startPicker')
  })
  $('clear-highlight').addEventListener('click', () => send('clearHighlight'))

  pauseBtn.addEventListener('click', () => {
    state.paused = !state.paused
    pauseBtn.textContent = state.paused ? 'Resume events' : 'Pause events'
  })

  for (const button of document.querySelectorAll('.tab[data-tab]')) {
    button.addEventListener('click', () => switchTab(button.dataset.tab))
  }

  chrome.runtime.onMessage.addListener((message, sender) => {
    if (!message || message.source !== PAGE_SOURCE) return
    if (sender.tab && sender.tab.id !== tabId) return

    switch (message.type) {
      case 'snapshot':
        applySnapshot(message.payload || {})
        break
      case 'state':
        if (message.payload?.id === state.selectedId) {
          state.selectedState = message.payload.state
          renderDetails()
        }
        break
      case 'picked':
        if (message.payload?.id != null) {
          setConnected(true)
          state.selectedId = message.payload.id
          state.selectedState = null
          switchTab('components')
          renderTree()
          renderDetails()
          requestState()
        }
        break
      case 'picker-started':
        statusEl.textContent = 'pick an element (Esc to cancel)'
        break
      case 'picker-empty':
        statusEl.textContent = 'no ActView component found'
        break
      case 'picker-cancelled':
        statusEl.textContent = state.connected ? 'connected' : 'disconnected'
        break
    }
  })

  // 面板打开 / 页面刷新后重连。
  send('connect')
  if (reconnectTimer) clearInterval(reconnectTimer)
  reconnectTimer = setInterval(() => {
    if (!state.connected) send('connect')
  }, 2000)

  // 页面 bridge 启动时可能先广播 snapshot；panel 打开时再主动 refresh 一次。
  window.addEventListener('beforeunload', () => {
    if (reconnectTimer) clearInterval(reconnectTimer)
    send('clearHighlight')
    send('stopPicker')
  })
})()
