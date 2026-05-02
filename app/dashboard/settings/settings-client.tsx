'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Crown, KeyRound, Palette, Type } from 'lucide-react'
import { DashboardSidebar } from '@/components/leads/DashboardSidebar'
import styles from '@/components/leads/LeadsDashboard.module.css'

type ThemeChoice = 'dark' | 'light'
type TextSize = 'sm' | 'md' | 'lg' | 'xl'
type AccessibilitySettings = {
  theme: ThemeChoice
  textSize: TextSize
  contrast: 'standard' | 'high'
  motion: 'standard' | 'reduced'
  font: 'standard' | 'readable'
  lineHeight: 'standard' | 'relaxed'
}

const ACCESSIBILITY_KEY = 'o2d_accessibility_settings'
const defaultAccessibility: AccessibilitySettings = {
  theme: 'dark',
  textSize: 'md',
  contrast: 'standard',
  motion: 'standard',
  font: 'standard',
  lineHeight: 'standard',
}

function logGdpr(action: string, resource: string, id: string, changes?: string) {
  const entry = { ts: new Date().toISOString(), action, resource, id, changes }
  const existing = JSON.parse(localStorage.getItem('gdpr_audit') || '[]')
  localStorage.setItem('gdpr_audit', JSON.stringify([entry, ...existing].slice(0, 500)))
}

export function SettingsClient() {
  const [activeTab, setActiveTab] = useState<'appearance' | 'license'>('appearance')
  const [theme, setTheme] = useState<ThemeChoice>('dark')
  const [textSize, setTextSize] = useState<TextSize>('md')
  const [contrast, setContrast] = useState<AccessibilitySettings['contrast']>('standard')
  const [motion, setMotion] = useState<AccessibilitySettings['motion']>('standard')
  const [font, setFont] = useState<AccessibilitySettings['font']>('standard')
  const [lineHeight, setLineHeight] = useState<AccessibilitySettings['lineHeight']>('standard')
  const [licenseKey, setLicenseKey] = useState('')
  const [licenseStatus, setLicenseStatus] = useState<'active' | 'trial' | 'none'>('trial')

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem(ACCESSIBILITY_KEY) || '{}') as Partial<AccessibilitySettings>
    const next = { ...defaultAccessibility, ...stored }
    setTheme(next.theme)
    setTextSize(next.textSize)
    setContrast(next.contrast)
    setMotion(next.motion)
    setFont(next.font)
    setLineHeight(next.lineHeight)
    setLicenseKey(localStorage.getItem('crm_license_key') || '')
    setLicenseStatus((localStorage.getItem('crm_license_status') as typeof licenseStatus) || 'trial')
  }, [])

  function saveAccessibility(patch: Partial<AccessibilitySettings>) {
    const next = { theme, textSize, contrast, motion, font, lineHeight, ...patch }
    setTheme(next.theme)
    setTextSize(next.textSize)
    setContrast(next.contrast)
    setMotion(next.motion)
    setFont(next.font)
    setLineHeight(next.lineHeight)

    document.documentElement.dataset.theme = next.theme
    document.documentElement.dataset.textSize = next.textSize
    document.documentElement.dataset.contrast = next.contrast
    document.documentElement.dataset.motion = next.motion
    document.documentElement.dataset.font = next.font
    document.documentElement.dataset.lineHeight = next.lineHeight
    document.documentElement.classList.toggle('dark', next.theme === 'dark')
    localStorage.setItem(ACCESSIBILITY_KEY, JSON.stringify(next))
    localStorage.setItem('crm_theme', next.theme)
    localStorage.setItem('crm_textsize', next.textSize === 'xl' ? 'lg' : next.textSize)
    logGdpr('update', 'site_accessibility_setting', 'global', JSON.stringify(patch))
  }

  function activateLicense() {
    if (!licenseKey.trim()) return
    localStorage.setItem('crm_license_key', licenseKey.trim())
    localStorage.setItem('crm_license_status', 'active')
    setLicenseStatus('active')
    logGdpr('activate', 'license', 'online2day', 'license key saved')
  }

  function revokeLicense() {
    localStorage.removeItem('crm_license_key')
    localStorage.setItem('crm_license_status', 'none')
    setLicenseKey('')
    setLicenseStatus('none')
    logGdpr('revoke', 'license', 'online2day')
  }

  return (
    <div className={styles.settingsShell} data-theme={theme} data-size={textSize === 'md' ? undefined : textSize === 'xl' ? 'lg' : textSize}>
      <DashboardSidebar active="settings" />
      <main className={styles.settingsMain}>
        <div className={styles.titleRow}>
          <h1>Settings</h1>
        </div>
        <p className={styles.subtle}>Preferences are saved locally and picked up by the leads dashboard.</p>

        <div className={styles.settingsTabs} role="tablist">
          <button className={`${styles.settingsTab} ${activeTab === 'appearance' ? styles.settingsTabActive : ''}`} onClick={() => setActiveTab('appearance')}>Appearance</button>
          <button className={`${styles.settingsTab} ${activeTab === 'license' ? styles.settingsTabActive : ''}`} onClick={() => setActiveTab('license')}>License</button>
        </div>

        {activeTab === 'appearance' ? (
          <section className={styles.settingsSection}>
            <header className={styles.settingsSectionHeader}>
              <h2>Theme and readability</h2>
              <p>Adjust how dense the dashboard feels during daily CRM work.</p>
            </header>
            <div className={styles.settingsSectionBody}>
              <div className={styles.settingRow}>
                <div className={styles.settingRowInfo}><strong>Theme</strong><span>Choose a dark or light workspace.</span></div>
                <div className={styles.themeOptions}>
                  {(['dark', 'light'] as ThemeChoice[]).map((choice) => (
                    <button key={choice} className={`${styles.themeOption} ${theme === choice ? styles.themeOptionActive : ''}`} onClick={() => saveAccessibility({ theme: choice })}>
                      <div className={styles.themePreview} style={{ background: choice === 'dark' ? 'linear-gradient(135deg, #05070b, #1b2a48)' : 'linear-gradient(135deg, #f7f9ff, #dce8ff)' }} />
                      <span>{choice === 'dark' ? 'Dark' : 'Light'}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.settingRow}>
                <div className={styles.settingRowInfo}><strong>Text size</strong><span>Scale interface copy for comfort.</span></div>
                <div className={styles.textSizeOptions}>
                  {(['sm', 'md', 'lg', 'xl'] as TextSize[]).map((size) => (
                    <button key={size} className={`${styles.textSizeOption} ${textSize === size ? styles.textSizeOptionActive : ''}`} onClick={() => saveAccessibility({ textSize: size })}>
                      <Type size={size === 'sm' ? 14 : size === 'md' ? 18 : size === 'lg' ? 22 : 26} />
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.settingRow}>
                <div className={styles.settingRowInfo}><strong>Accessibility support</strong><span>Apply stronger contrast, reduced motion and easier reading across the whole site.</span></div>
                <div className={styles.licenseActions}>
                  <button className={`${styles.btnSecondary} ${contrast === 'high' ? styles.filterActive : ''}`} onClick={() => saveAccessibility({ contrast: contrast === 'high' ? 'standard' : 'high' })}>High contrast</button>
                  <button className={`${styles.btnSecondary} ${motion === 'reduced' ? styles.filterActive : ''}`} onClick={() => saveAccessibility({ motion: motion === 'reduced' ? 'standard' : 'reduced' })}>Reduce motion</button>
                  <button className={`${styles.btnSecondary} ${font === 'readable' ? styles.filterActive : ''}`} onClick={() => saveAccessibility({ font: font === 'readable' ? 'standard' : 'readable' })}>Readable font</button>
                  <button className={`${styles.btnSecondary} ${lineHeight === 'relaxed' ? styles.filterActive : ''}`} onClick={() => saveAccessibility({ lineHeight: lineHeight === 'relaxed' ? 'standard' : 'relaxed' })}>Relax spacing</button>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className={styles.settingsSection}>
            <header className={styles.settingsSectionHeader}>
              <h2>License management</h2>
              <p>Manage the plan state used by this browser session.</p>
            </header>
            <div className={styles.settingsSectionBody}>
              <div className={styles.licenseCard}>
                <div className={styles.licenseIcon}>{licenseStatus === 'active' ? <Crown size={22} /> : <KeyRound size={22} />}</div>
                <div className={styles.licenseInfo}>
                  <strong>{licenseStatus === 'active' ? 'Pro license active' : licenseStatus === 'trial' ? 'Trial license' : 'No license active'}</strong>
                  <span>{licenseStatus === 'active' ? 'Unlimited videos, advanced analytics and audit export are enabled.' : 'Add a license key or choose a plan to unlock Pro.'}</span>
                </div>
                {licenseStatus === 'active' ? <span className={styles.gdprBadge}><Check size={13} />Verified</span> : null}
              </div>
              <div className={styles.formRow}>
                <label>License key</label>
                <input className={styles.formInput} value={licenseKey} onChange={(event) => setLicenseKey(event.target.value)} placeholder="O2D-PRO-XXXX-XXXX" />
              </div>
              <div className={styles.licenseActions}>
                <button className={styles.btnPrimary} onClick={activateLicense}>Activate license</button>
                <button className={styles.btnSecondary} onClick={revokeLicense}>Remove</button>
                <Link className={styles.btnSecondary} href="/pricing">View plans</Link>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
