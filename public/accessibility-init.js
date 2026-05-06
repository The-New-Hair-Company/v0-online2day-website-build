(() => {
  try {
    const settings = JSON.parse(localStorage.getItem('o2d_accessibility_settings') || '{}')
    const root = document.documentElement
    const theme = settings.theme || localStorage.getItem('crm_theme') || 'dark'
    const textScale = settings.textScale || 100
    root.dataset.theme = theme
    root.dataset.textSize = settings.textSize || localStorage.getItem('crm_textsize') || 'md'
    root.dataset.contrast = settings.contrast || 'standard'
    root.dataset.motion = settings.motion || 'standard'
    root.dataset.font = settings.font || 'standard'
    root.dataset.lineHeight = settings.lineHeight || 'standard'
    root.style.setProperty('--accessibility-text-scale', String(textScale / 100))
    root.classList.toggle('dark', theme === 'dark')
  } catch (_error) {
    // best-effort bootstrap only
  }
})()
