'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Check, Crown, KeyRound, Mail, ShieldCheck, Trash2, Type, UserPlus, Users } from 'lucide-react'
import { DashboardSidebar } from '@/components/leads/DashboardSidebar'
import styles from '@/components/leads/LeadsDashboard.module.css'
import { logAuditEntry } from '@/lib/actions/audit-actions'
import { addLicensedUser, getAdminPrefs, getLicenseManagementState, removeLicensedUser, setAdminPrefs, updateLicensedUserRole } from '@/lib/actions/settings-actions'
import type { LicenseManagementState, LicensedUserRole } from '@/lib/license'

type ThemeChoice = 'dark' | 'light'
type TextSize = 'sm' | 'md' | 'lg' | 'xl'
type AccessibilitySettings = {
  theme: ThemeChoice
  textSize: TextSize
  textScale: number
  contrast: 'standard' | 'high'
  motion: 'standard' | 'reduced'
  font: 'standard' | 'readable'
  lineHeight: 'standard' | 'relaxed'
}

const ACCESSIBILITY_KEY = 'o2d_accessibility_settings'
const defaultAccessibility: AccessibilitySettings = {
  theme: 'dark',
  textSize: 'md',
  textScale: 100,
  contrast: 'standard',
  motion: 'standard',
  font: 'standard',
  lineHeight: 'standard',
}

const defaultLicenseState: LicenseManagementState = {
  users: [],
  seatLimit: 25,
  activeSeatCount: 0,
  adminEmails: [],
  canManage: false,
  warning: null,
}

function textSizeFromScale(scale: number): TextSize {
  if (scale < 96) return 'sm'
  if (scale < 112) return 'md'
  if (scale < 124) return 'lg'
  return 'xl'
}

function scaleFromTextSize(size: TextSize) {
  if (size === 'sm') return 94
  if (size === 'lg') return 112
  if (size === 'xl') return 124
  return 100
}

export function SettingsClient() {
  const [activeTab, setActiveTab] = useState<'appearance' | 'license'>('appearance')
  const [theme, setTheme] = useState<ThemeChoice>('dark')
  const [textSize, setTextSize] = useState<TextSize>('md')
  const [textScale, setTextScale] = useState(100)
  const [contrast, setContrast] = useState<AccessibilitySettings['contrast']>('standard')
  const [motion, setMotion] = useState<AccessibilitySettings['motion']>('standard')
  const [font, setFont] = useState<AccessibilitySettings['font']>('standard')
  const [lineHeight, setLineHeight] = useState<AccessibilitySettings['lineHeight']>('standard')
  const [licenseKey, setLicenseKey] = useState('')
  const [licenseStatus, setLicenseStatus] = useState<'active' | 'trial' | 'none'>('trial')
  const [licenseState, setLicenseState] = useState<LicenseManagementState>(defaultLicenseState)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserName, setNewUserName] = useState('')
  const [newUserRole, setNewUserRole] = useState<LicensedUserRole>('member')
  const [licenseNotice, setLicenseNotice] = useState('')
  const [licenseNoticeType, setLicenseNoticeType] = useState<'success' | 'warning'>('success')
  const [licenseBusy, setLicenseBusy] = useState(false)

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem(ACCESSIBILITY_KEY) || '{}') as Partial<AccessibilitySettings>
    const next = { ...defaultAccessibility, ...stored }
    setTheme(next.theme)
    setTextSize(next.textSize)
    setTextScale(next.textScale || scaleFromTextSize(next.textSize))
    setContrast(next.contrast)
    setMotion(next.motion)
    setFont(next.font)
    setLineHeight(next.lineHeight)

    getAdminPrefs(['license.key', 'license.status']).then((prefs) => {
      setLicenseKey(prefs['license.key'] || '')
      setLicenseStatus((prefs['license.status'] as typeof licenseStatus) || 'trial')
    })
    getLicenseManagementState().then(setLicenseState)
  }, [])

  function saveAccessibility(patch: Partial<AccessibilitySettings>) {
    const patchedScale = patch.textScale
    const patchedTextSize = patch.textSize
    const next = {
      ...{ theme, textSize, textScale, contrast, motion, font, lineHeight },
      ...patch,
      textScale: patchedScale ?? (patchedTextSize ? scaleFromTextSize(patchedTextSize) : textScale),
      textSize: patchedTextSize ?? (patchedScale ? textSizeFromScale(patchedScale) : textSize),
    }
    setTheme(next.theme)
    setTextSize(next.textSize)
    setTextScale(next.textScale)
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
    document.documentElement.style.setProperty('--accessibility-text-scale', String(next.textScale / 100))
    document.documentElement.classList.toggle('dark', next.theme === 'dark')
    localStorage.setItem(ACCESSIBILITY_KEY, JSON.stringify(next))
    localStorage.setItem('crm_theme', next.theme)
    localStorage.setItem('crm_textsize', next.textSize === 'xl' ? 'lg' : next.textSize)
    logAuditEntry('update', 'site_accessibility_setting', 'global', JSON.stringify(patch))
  }

  async function activateLicense() {
    if (!licenseKey.trim()) return
    await setAdminPrefs({ 'license.key': licenseKey.trim(), 'license.status': 'active' })
    setLicenseStatus('active')
    logAuditEntry('activate', 'license', 'online2day', 'license key saved')
  }

  async function revokeLicense() {
    await setAdminPrefs({ 'license.key': '', 'license.status': 'none' })
    setLicenseKey('')
    setLicenseStatus('none')
    logAuditEntry('revoke', 'license', 'online2day')
  }

  async function addSeat() {
    if (!newUserEmail.trim()) {
      setLicenseNotice('Enter an email address before adding a seat.')
      setLicenseNoticeType('warning')
      return
    }
    setLicenseBusy(true)
    const result = await addLicensedUser({ email: newUserEmail, fullName: newUserName, role: newUserRole })
    if (result.state) setLicenseState(result.state)
    setLicenseNotice(result.error || `Licensed seat added for ${newUserEmail.trim().toLowerCase()}.`)
    setLicenseNoticeType(result.error ? 'warning' : 'success')
    if (result.success && !result.error) {
      setNewUserEmail('')
      setNewUserName('')
      setNewUserRole('member')
      logAuditEntry('create', 'licensed_user', newUserEmail.trim().toLowerCase(), `role=${newUserRole}`)
    }
    setLicenseBusy(false)
  }

  async function changeSeatRole(email: string, role: LicensedUserRole) {
    setLicenseBusy(true)
    const result = await updateLicensedUserRole(email, role)
    if (result.state) setLicenseState(result.state)
    setLicenseNotice(result.error || `${email} is now a ${role}.`)
    setLicenseNoticeType(result.error ? 'warning' : 'success')
    if (result.success) logAuditEntry('update', 'licensed_user', email, `role=${role}`)
    setLicenseBusy(false)
  }

  async function removeSeat(email: string) {
    setLicenseBusy(true)
    const result = await removeLicensedUser(email)
    if (result.state) setLicenseState(result.state)
    setLicenseNotice(result.error || `${email} was removed from the license.`)
    setLicenseNoticeType(result.error ? 'warning' : 'success')
    if (result.success) logAuditEntry('delete', 'licensed_user', email)
    setLicenseBusy(false)
  }

  return (
    <div className={styles.settingsShell} data-theme={theme} data-size={textSize === 'md' ? undefined : textSize === 'xl' ? 'lg' : textSize}>
      <DashboardSidebar active="settings" />
      <main className={styles.settingsMain}>
        <div className={styles.titleRow}>
          <h1>Settings</h1>
        </div>
        <p className={styles.subtle}>Preferences are saved locally and applied across the website, dashboard, editor and video pages.</p>

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
                <div className={styles.textScaleControl}>
                  <div className={styles.textScaleMeta}><Type size={16} /><strong>{textScale}%</strong></div>
                  <input
                    type="range"
                    min="90"
                    max="132"
                    step="2"
                    value={textScale}
                    onChange={(event) => saveAccessibility({ textScale: Number(event.target.value) })}
                    aria-label="Sitewide text size scale"
                  />
                  <div className={styles.textSizeOptions}>
                    {(['sm', 'md', 'lg', 'xl'] as TextSize[]).map((size) => (
                      <button key={size} className={`${styles.textSizeOption} ${textSize === size ? styles.textSizeOptionActive : ''}`} onClick={() => saveAccessibility({ textSize: size })}>
                        <Type size={size === 'sm' ? 14 : size === 'md' ? 18 : size === 'lg' ? 22 : 26} />
                      </button>
                    ))}
                  </div>
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
              <p>Manage the plan state, protected admins and licensed users who can access the system.</p>
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
              <div className={styles.licenseMetrics}>
                <div>
                  <span>Licensed seats</span>
                  <strong>{licenseState.activeSeatCount}/{licenseState.seatLimit}</strong>
                </div>
                <div>
                  <span>Admins</span>
                  <strong>{licenseState.users.filter((user) => user.role === 'admin').length}</strong>
                </div>
                <div>
                  <span>Protected</span>
                  <strong>{licenseState.adminEmails.length}</strong>
                </div>
              </div>
              {licenseState.warning || licenseNotice ? (
                <div className={licenseState.warning || licenseNoticeType === 'warning' ? styles.licenseWarning : styles.licenseNotice}>
                  {licenseState.warning || licenseNoticeType === 'warning' ? <AlertTriangle size={15} /> : <Check size={15} />}
                  <span>{licenseNotice || licenseState.warning}</span>
                </div>
              ) : null}
              <div className={styles.formRow}>
                <label>License key</label>
                <input className={styles.formInput} value={licenseKey} onChange={(event) => setLicenseKey(event.target.value)} placeholder="O2D-PRO-XXXX-XXXX" />
              </div>
              <div className={styles.licenseActions}>
                <button className={styles.btnPrimary} onClick={activateLicense}>Activate license</button>
                <button className={styles.btnSecondary} onClick={revokeLicense}>Remove</button>
                <Link className={styles.btnSecondary} href="/pricing">View plans</Link>
              </div>

              <div className={styles.licenseAdminPanel}>
                <div className={styles.licensePanelHeader}>
                  <div>
                    <h3>Licensed users</h3>
                    <p>Admin accounts can add, remove and assign seats. Oliver and info@online2day.com stay protected.</p>
                  </div>
                  <span><ShieldCheck size={14} />Admin controlled</span>
                </div>

                <div className={styles.licenseAddGrid}>
                  <div className={styles.formRow}>
                    <label>Email</label>
                    <div className={styles.inputWithIcon}><Mail size={15} /><input value={newUserEmail} onChange={(event) => setNewUserEmail(event.target.value)} placeholder="name@company.com" /></div>
                  </div>
                  <div className={styles.formRow}>
                    <label>Name</label>
                    <input className={styles.formInput} value={newUserName} onChange={(event) => setNewUserName(event.target.value)} placeholder="Optional display name" />
                  </div>
                  <div className={styles.formRow}>
                    <label>Role</label>
                    <select className={styles.formSelect} value={newUserRole} onChange={(event) => setNewUserRole(event.target.value as LicensedUserRole)}>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <button className={styles.btnPrimary} onClick={addSeat} disabled={licenseBusy || !licenseState.canManage}><UserPlus size={15} />Add user</button>
                </div>

                <div className={styles.licenseUserTable}>
                  <div className={styles.licenseUserHeader}>
                    <span>User</span>
                    <span>Role</span>
                    <span>Status</span>
                    <span>Actions</span>
                  </div>
                  {licenseState.users.map((user) => (
                    <div key={user.email} className={styles.licenseUserRow}>
                      <div className={styles.licenseUserIdentity}>
                        <div className={user.role === 'admin' ? styles.licenseAdminAvatar : styles.licenseMemberAvatar}>
                          {user.role === 'admin' ? <ShieldCheck size={16} /> : <Users size={16} />}
                        </div>
                        <div>
                          <strong>{user.fullName || user.email}</strong>
                          <span>{user.email}</span>
                        </div>
                      </div>
                      <select
                        className={styles.licenseRoleSelect}
                        value={user.role}
                        disabled={user.isProtected || licenseBusy}
                        onChange={(event) => void changeSeatRole(user.email, event.target.value as LicensedUserRole)}
                      >
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                        <option value="admin">Admin</option>
                      </select>
                      <div className={styles.licenseStatusStack}>
                        <span className={user.status === 'active' ? styles.licenseStatusActive : styles.licenseStatusMuted}>{user.status}</span>
                        {user.isProtected ? <em>Protected admin</em> : <em>{user.seatType} seat</em>}
                      </div>
                      <button className={styles.btnSecondary} onClick={() => void removeSeat(user.email)} disabled={user.isProtected || licenseBusy}>
                        <Trash2 size={14} />Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
