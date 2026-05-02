'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Eye, Settings, Type } from 'lucide-react'

type AccessibilitySettings = {
  theme: 'dark' | 'light'
  textSize: 'sm' | 'md' | 'lg' | 'xl'
  contrast: 'standard' | 'high'
  motion: 'standard' | 'reduced'
  font: 'standard' | 'readable'
  lineHeight: 'standard' | 'relaxed'
}

const STORAGE_KEY = 'o2d_accessibility_settings'

const defaults: AccessibilitySettings = {
  theme: 'dark',
  textSize: 'md',
  contrast: 'standard',
  motion: 'standard',
  font: 'standard',
  lineHeight: 'standard',
}

function readSettings(): AccessibilitySettings {
  if (typeof window === 'undefined') return defaults

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    const legacyTheme = localStorage.getItem('crm_theme')
    const legacyText = localStorage.getItem('crm_textsize')

    return {
      ...defaults,
      ...stored,
      theme: stored.theme || legacyTheme || defaults.theme,
      textSize: stored.textSize || legacyText || defaults.textSize,
    }
  } catch {
    return defaults
  }
}

function applySettings(settings: AccessibilitySettings) {
  const root = document.documentElement
  root.dataset.theme = settings.theme
  root.dataset.textSize = settings.textSize
  root.dataset.contrast = settings.contrast
  root.dataset.motion = settings.motion
  root.dataset.font = settings.font
  root.dataset.lineHeight = settings.lineHeight
  root.classList.toggle('dark', settings.theme === 'dark')

  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  localStorage.setItem('crm_theme', settings.theme)
  localStorage.setItem('crm_textsize', settings.textSize === 'xl' ? 'lg' : settings.textSize)
}

export function AccessibilitySettingsButton() {
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState<AccessibilitySettings>(defaults)

  useEffect(() => {
    const next = readSettings()
    setSettings(next)
    applySettings(next)
  }, [])

  function update(patch: Partial<AccessibilitySettings>) {
    setSettings((current) => {
      const next = { ...current, ...patch }
      applySettings(next)
      return next
    })
  }

  const rows = useMemo(() => [
    {
      label: 'Theme',
      value: settings.theme,
      options: [
        { label: 'Dark', value: 'dark' },
        { label: 'Light', value: 'light' },
      ] as const,
      onChange: (value: AccessibilitySettings['theme']) => update({ theme: value }),
    },
    {
      label: 'Text size',
      value: settings.textSize,
      options: [
        { label: 'Small', value: 'sm' },
        { label: 'Medium', value: 'md' },
        { label: 'Large', value: 'lg' },
        { label: 'Extra', value: 'xl' },
      ] as const,
      onChange: (value: AccessibilitySettings['textSize']) => update({ textSize: value }),
    },
  ], [settings.theme, settings.textSize])

  return (
    <div className="accessibility-widget">
      {open ? (
        <section className="accessibility-panel" aria-label="Accessibility settings">
          <header>
            <div>
              <strong>Accessibility</strong>
              <span>Make Online2Day easier to use.</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close accessibility settings">x</button>
          </header>

          {rows.map((row) => (
            <div className="accessibility-group" key={row.label}>
              <span>{row.label}</span>
              <div>
                {row.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={row.value === option.value ? 'is-active' : undefined}
                    onClick={() => row.onChange(option.value as never)}
                  >
                    {row.value === option.value ? <Check size={13} /> : null}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="accessibility-group">
            <span>Comfort</span>
            <div>
              <button type="button" className={settings.contrast === 'high' ? 'is-active' : undefined} onClick={() => update({ contrast: settings.contrast === 'high' ? 'standard' : 'high' })}>
                <Eye size={13} /> High contrast
              </button>
              <button type="button" className={settings.font === 'readable' ? 'is-active' : undefined} onClick={() => update({ font: settings.font === 'readable' ? 'standard' : 'readable' })}>
                <Type size={13} /> Readable font
              </button>
              <button type="button" className={settings.lineHeight === 'relaxed' ? 'is-active' : undefined} onClick={() => update({ lineHeight: settings.lineHeight === 'relaxed' ? 'standard' : 'relaxed' })}>
                Relax spacing
              </button>
              <button type="button" className={settings.motion === 'reduced' ? 'is-active' : undefined} onClick={() => update({ motion: settings.motion === 'reduced' ? 'standard' : 'reduced' })}>
                Reduce motion
              </button>
            </div>
          </div>
        </section>
      ) : null}
      <button
        type="button"
        className="accessibility-trigger"
        aria-label="Open accessibility settings"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Settings size={20} />
      </button>
    </div>
  )
}
