'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Check, Crown, KeyRound, Mail, ShieldCheck, Trash2, Type, UserPlus, Users } from 'lucide-react'
import { DashboardSidebar } from '@/components/leads/DashboardSidebar'
import styles from '@/components/leads/LeadsDashboard.module.css'
import { getAuditLog, logAuditEntry } from '@/lib/actions/audit-actions'
import { addLicensedUser, getAdminPrefs, getLicenseManagementState, removeLicensedUser, setAdminPrefs, updateLicensedUserRole } from '@/lib/actions/settings-actions'
import { clearAsyncFailureQueue, getAsyncFailureQueue } from '@/lib/actions/reliability-actions'
import { clearSecurityEvents, getSecurityEvents } from '@/lib/security/security-events'

const THEME_SUPABASE_KEYS = ['theme', 'textSize', 'textScale', 'contrast', 'motion', 'font', 'lineHeight'] as const
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

const CRM_SETUP_KEYS = [
  'config.companyName',
  'config.defaultSenderName',
  'config.defaultSenderEmail',
  'config.bookingUrl',
  'config.defaultCtaLabel',
  'config.defaultCtaUrl',
  'config.timezone',
  'config.followupHours',
  'config.hotLeadScore',
  'config.pipelineStages',
  'config.onboardingComplete',
] as const

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
  const [activeTab, setActiveTab] = useState<'setup' | 'appearance' | 'license'>('setup')
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
  const [setupSaving, setSetupSaving] = useState(false)
  const [setupNotice, setSetupNotice] = useState('')
  const [companyName, setCompanyName] = useState('Online2Day')
  const [defaultSenderName, setDefaultSenderName] = useState('Online2Day Team')
  const [defaultSenderEmail, setDefaultSenderEmail] = useState('info@online2day.com')
  const [bookingUrl, setBookingUrl] = useState('https://calendly.com/online2day/demo')
  const [defaultCtaLabel, setDefaultCtaLabel] = useState('Book a call')
  const [defaultCtaUrl, setDefaultCtaUrl] = useState('https://calendly.com/online2day/demo')
  const [timezone, setTimezone] = useState('Europe/London')
  const [followupHours, setFollowupHours] = useState('24')
  const [hotLeadScore, setHotLeadScore] = useState('80')
  const [pipelineStages, setPipelineStages] = useState('New, Contacted, Qualified, Proposal Sent, Negotiation, Won')
  const [onboardingComplete, setOnboardingComplete] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState(0)
  const [auditItems, setAuditItems] = useState<Array<{
    id: string
    action: string
    resource: string
    actor_email: string | null
    created_at: string
  }>>([])
  const [asyncFailures, setAsyncFailures] = useState<Array<{
    action: string
    userId: string | null
    errorCode: string
    errorMessage: string
    recoverable: boolean
    createdAt: string
  }>>([])
  const [securityEvents, setSecurityEvents] = useState<Array<{
    type: string
    route: string
    ip: string
    detail: string
    createdAt: string
  }>>([])

  useEffect(() => {
    // Apply localStorage instantly (no flicker on repeated visits)
    const stored = JSON.parse(localStorage.getItem(ACCESSIBILITY_KEY) || '{}') as Partial<AccessibilitySettings>
    const local = { ...defaultAccessibility, ...stored }
    setTheme(local.theme)
    setTextSize(local.textSize)
    setTextScale(local.textScale || scaleFromTextSize(local.textSize))
    setContrast(local.contrast)
    setMotion(local.motion)
    setFont(local.font)
    setLineHeight(local.lineHeight)

    // Load all prefs from Supabase — theme prefs take precedence (cross-device sync)
    getAdminPrefs([...THEME_SUPABASE_KEYS, 'license.key', 'license.status', ...CRM_SETUP_KEYS]).then((prefs) => {
      setLicenseKey(prefs['license.key'] || '')
      setLicenseStatus((prefs['license.status'] as typeof licenseStatus) || 'trial')
      setCompanyName(prefs['config.companyName'] || 'Online2Day')
      setDefaultSenderName(prefs['config.defaultSenderName'] || 'Online2Day Team')
      setDefaultSenderEmail(prefs['config.defaultSenderEmail'] || 'info@online2day.com')
      setBookingUrl(prefs['config.bookingUrl'] || 'https://calendly.com/online2day/demo')
      setDefaultCtaLabel(prefs['config.defaultCtaLabel'] || 'Book a call')
      setDefaultCtaUrl(prefs['config.defaultCtaUrl'] || 'https://calendly.com/online2day/demo')
      setTimezone(prefs['config.timezone'] || 'Europe/London')
      setFollowupHours(prefs['config.followupHours'] || '24')
      setHotLeadScore(prefs['config.hotLeadScore'] || '80')
      setPipelineStages(prefs['config.pipelineStages'] || 'New, Contacted, Qualified, Proposal Sent, Negotiation, Won')
      setOnboardingComplete(prefs['config.onboardingComplete'] === 'true')

      if (prefs['theme']) {
        const scale = Number(prefs['textScale']) || scaleFromTextSize((prefs['textSize'] as TextSize) || local.textSize)
        const synced: AccessibilitySettings = {
          theme: (prefs['theme'] as ThemeChoice) || local.theme,
          textSize: (prefs['textSize'] as TextSize) || local.textSize,
          textScale: scale,
          contrast: (prefs['contrast'] as AccessibilitySettings['contrast']) || local.contrast,
          motion: (prefs['motion'] as AccessibilitySettings['motion']) || local.motion,
          font: (prefs['font'] as AccessibilitySettings['font']) || local.font,
          lineHeight: (prefs['lineHeight'] as AccessibilitySettings['lineHeight']) || local.lineHeight,
        }
        setTheme(synced.theme)
        setTextSize(synced.textSize)
        setTextScale(synced.textScale)
        setContrast(synced.contrast)
        setMotion(synced.motion)
        setFont(synced.font)
        setLineHeight(synced.lineHeight)
        // Apply to DOM
        document.documentElement.dataset.theme = synced.theme
        document.documentElement.dataset.textSize = synced.textSize
        document.documentElement.dataset.contrast = synced.contrast
        document.documentElement.dataset.motion = synced.motion
        document.documentElement.dataset.font = synced.font
        document.documentElement.dataset.lineHeight = synced.lineHeight
        document.documentElement.style.setProperty('--accessibility-text-scale', String(synced.textScale / 100))
        document.documentElement.classList.toggle('dark', synced.theme === 'dark')
        // Keep localStorage in sync
        localStorage.setItem(ACCESSIBILITY_KEY, JSON.stringify(synced))
        localStorage.setItem('crm_theme', synced.theme)
        localStorage.setItem('crm_textsize', synced.textSize === 'xl' ? 'lg' : synced.textSize)
      }
    })
    getLicenseManagementState().then(setLicenseState)
    getAuditLog(12).then((items) => {
      const normalised = (items || []).map((item: any) => ({
        id: String(item.id ?? `${item.action}-${item.created_at}`),
        action: String(item.action || 'update'),
        resource: String(item.resource || 'system'),
        actor_email: item.actor_email ? String(item.actor_email) : null,
        created_at: String(item.created_at || new Date().toISOString()),
      }))
      setAuditItems(normalised)
    })
    getAsyncFailureQueue(20).then(setAsyncFailures)
    getSecurityEvents(20).then(setSecurityEvents)
  }, [])

  const setupCompletion = [
    companyName.trim(),
    defaultSenderName.trim(),
    defaultSenderEmail.trim(),
    bookingUrl.trim(),
    defaultCtaLabel.trim(),
    defaultCtaUrl.trim(),
    timezone.trim(),
    followupHours.trim(),
    hotLeadScore.trim(),
    pipelineStages.trim(),
  ].filter(Boolean).length
  const setupProgress = Math.round((setupCompletion / 10) * 100)
  const onboardingSteps = [
    'Company profile',
    'Sender and outreach defaults',
    'CTA and booking settings',
    'Pipeline and SLA thresholds',
  ]
  const showOnboardingWizard = !onboardingComplete

  async function saveSetupConfig() {
    if (!defaultSenderEmail.includes('@')) {
      setSetupNotice('Please enter a valid sender email.')
      return
    }
    if (!bookingUrl.startsWith('http') || !defaultCtaUrl.startsWith('http')) {
      setSetupNotice('Booking URL and CTA URL must start with http or https.')
      return
    }
    setSetupSaving(true)
    await setAdminPrefs({
      'config.companyName': companyName.trim(),
      'config.defaultSenderName': defaultSenderName.trim(),
      'config.defaultSenderEmail': defaultSenderEmail.trim().toLowerCase(),
      'config.bookingUrl': bookingUrl.trim(),
      'config.defaultCtaLabel': defaultCtaLabel.trim(),
      'config.defaultCtaUrl': defaultCtaUrl.trim(),
      'config.timezone': timezone.trim(),
      'config.followupHours': followupHours.trim(),
      'config.hotLeadScore': hotLeadScore.trim(),
      'config.pipelineStages': pipelineStages.trim(),
    })
    await logAuditEntry('update', 'crm_setup_config', 'global', JSON.stringify({
      companyName: companyName.trim(),
      defaultSenderEmail: defaultSenderEmail.trim().toLowerCase(),
      bookingUrl: bookingUrl.trim(),
      timezone: timezone.trim(),
    }))
    setSetupNotice('Setup configuration saved. These defaults now apply across CRM workflows.')
    setSetupSaving(false)
  }

  async function completeOnboarding() {
    await setAdminPrefs({ 'config.onboardingComplete': 'true' })
    setOnboardingComplete(true)
    setSetupNotice('Onboarding complete. You can still edit any setup default at any time.')
    await logAuditEntry('complete', 'crm_setup_onboarding', 'global')
  }

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

    // Persist to Supabase for cross-device sync (fire and forget)
    setAdminPrefs({
      theme: next.theme,
      textSize: next.textSize,
      textScale: String(next.textScale),
      contrast: next.contrast,
      motion: next.motion,
      font: next.font,
      lineHeight: next.lineHeight,
    })
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
          <button className={`${styles.settingsTab} ${activeTab === 'setup' ? styles.settingsTabActive : ''}`} onClick={() => setActiveTab('setup')}>Setup Center</button>
          <button className={`${styles.settingsTab} ${activeTab === 'appearance' ? styles.settingsTabActive : ''}`} onClick={() => setActiveTab('appearance')}>Appearance</button>
          <button className={`${styles.settingsTab} ${activeTab === 'license' ? styles.settingsTabActive : ''}`} onClick={() => setActiveTab('license')}>License</button>
        </div>

        {activeTab === 'setup' ? (
          <section className={styles.settingsSection}>
            <header className={styles.settingsSectionHeader}>
              <h2>CRM Setup Center</h2>
              <p>Configure all core defaults in one place. This is the fastest route to a production-ready CRM.</p>
            </header>
            <div className={styles.settingsSectionBody}>
              {showOnboardingWizard ? (
                <div className={styles.licenseCard}>
                  <div className={styles.licenseIcon}><Users size={22} /></div>
                  <div className={styles.licenseInfo}>
                    <strong>First-time onboarding wizard</strong>
                    <span>Step {onboardingStep + 1} of {onboardingSteps.length}: {onboardingSteps[onboardingStep]}</span>
                  </div>
                  <span className={styles.gdprBadge}>5 min setup</span>
                </div>
              ) : null}
              <div className={styles.licenseCard}>
                <div className={styles.licenseIcon}><ShieldCheck size={22} /></div>
                <div className={styles.licenseInfo}>
                  <strong>Setup progress: {setupProgress}%</strong>
                  <span>{setupCompletion} of 10 core configuration blocks completed.</span>
                </div>
                {setupProgress === 100 ? <span className={styles.gdprBadge}><Check size={13} />Ready</span> : null}
              </div>
              <div className={styles.licenseCard} style={{ alignItems: 'flex-start' }}>
                <div className={styles.licenseInfo}>
                  <strong>Recent audit activity</strong>
                  <span>Critical setup and admin actions are tracked for accountability.</span>
                </div>
                <div className={styles.licenseUserTable} style={{ width: '100%', marginTop: 10 }}>
                  <div className={styles.licenseUserHeader} style={{ gridTemplateColumns: '1.1fr 1fr 1.2fr 1fr' }}>
                    <span>Action</span>
                    <span>Resource</span>
                    <span>Actor</span>
                    <span>Time</span>
                  </div>
                  {auditItems.length === 0 ? (
                    <div className={styles.licenseUserRow} style={{ gridTemplateColumns: '1fr' }}>
                      <span style={{ color: '#9db0c8' }}>No recent audit records yet.</span>
                    </div>
                  ) : auditItems.map((item) => (
                    <div key={item.id} className={styles.licenseUserRow} style={{ gridTemplateColumns: '1.1fr 1fr 1.2fr 1fr' }}>
                      <strong style={{ textTransform: 'capitalize' }}>{item.action.replace(/_/g, ' ')}</strong>
                      <span>{item.resource.replace(/_/g, ' ')}</span>
                      <span>{item.actor_email || 'System'}</span>
                      <span>{new Date(item.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.licenseCard} style={{ alignItems: 'flex-start' }}>
                <div className={styles.licenseInfo}>
                  <strong>Async failure queue</strong>
                  <span>Recoverable background failures from email, video, and integrations.</span>
                </div>
                <div className={styles.licenseActions} style={{ marginTop: 8 }}>
                  <button className={styles.btnSecondary} onClick={async () => setAsyncFailures(await getAsyncFailureQueue(20))}>
                    Refresh queue
                  </button>
                  <button className={styles.btnSecondary} onClick={async () => {
                    await clearAsyncFailureQueue()
                    setAsyncFailures([])
                    setSetupNotice('Async failure queue cleared.')
                  }}>
                    Clear queue
                  </button>
                </div>
                <div className={styles.licenseUserTable} style={{ width: '100%', marginTop: 10 }}>
                  <div className={styles.licenseUserHeader} style={{ gridTemplateColumns: '1.2fr 0.8fr 1fr 1fr' }}>
                    <span>Action</span>
                    <span>Code</span>
                    <span>Recoverable</span>
                    <span>Time</span>
                  </div>
                  {asyncFailures.length === 0 ? (
                    <div className={styles.licenseUserRow} style={{ gridTemplateColumns: '1fr' }}>
                      <span style={{ color: '#9db0c8' }}>No queued failures.</span>
                    </div>
                  ) : asyncFailures.map((item, index) => (
                    <div key={`${item.action}-${item.createdAt}-${index}`} className={styles.licenseUserRow} style={{ gridTemplateColumns: '1.2fr 0.8fr 1fr 1fr' }}>
                      <div>
                        <strong>{item.action.replace(/_/g, ' ')}</strong>
                        <div style={{ color: '#9db0c8', fontSize: 12, marginTop: 2 }}>{item.errorMessage}</div>
                      </div>
                      <span>{item.errorCode}</span>
                      <span>{item.recoverable ? 'Yes' : 'No'}</span>
                      <span>{new Date(item.createdAt).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.licenseCard} style={{ alignItems: 'flex-start' }}>
                <div className={styles.licenseInfo}>
                  <strong>Security events</strong>
                  <span>Invalid UUID, auth failures, rate-limit, and CSP violation telemetry.</span>
                </div>
                <div className={styles.licenseActions} style={{ marginTop: 8 }}>
                  <button className={styles.btnSecondary} onClick={async () => setSecurityEvents(await getSecurityEvents(20))}>
                    Refresh events
                  </button>
                  <button className={styles.btnSecondary} onClick={async () => {
                    await clearSecurityEvents()
                    setSecurityEvents([])
                    setSetupNotice('Security events cleared.')
                  }}>
                    Clear events
                  </button>
                </div>
                <div className={styles.licenseUserTable} style={{ width: '100%', marginTop: 10 }}>
                  <div className={styles.licenseUserHeader} style={{ gridTemplateColumns: '1fr 1fr 1fr 1.1fr' }}>
                    <span>Type</span>
                    <span>Route</span>
                    <span>IP</span>
                    <span>Time</span>
                  </div>
                  {securityEvents.length === 0 ? (
                    <div className={styles.licenseUserRow} style={{ gridTemplateColumns: '1fr' }}>
                      <span style={{ color: '#9db0c8' }}>No security events.</span>
                    </div>
                  ) : securityEvents.map((item, index) => (
                    <div key={`${item.type}-${item.createdAt}-${index}`} className={styles.licenseUserRow} style={{ gridTemplateColumns: '1fr 1fr 1fr 1.1fr' }}>
                      <div>
                        <strong>{item.type.replace(/_/g, ' ')}</strong>
                        {item.detail ? <div style={{ color: '#9db0c8', fontSize: 12, marginTop: 2 }}>{item.detail}</div> : null}
                      </div>
                      <span>{item.route}</span>
                      <span>{item.ip}</span>
                      <span>{new Date(item.createdAt).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.formGrid2}>
                <div className={styles.formRow}><label>Company name</label><input className={styles.formInput} value={companyName} onChange={(event) => setCompanyName(event.target.value)} /></div>
                <div className={styles.formRow}><label>Timezone</label><input className={styles.formInput} value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="Europe/London" /></div>
              </div>
              <div className={styles.formGrid2}>
                <div className={styles.formRow}><label>Default sender name</label><input className={styles.formInput} value={defaultSenderName} onChange={(event) => setDefaultSenderName(event.target.value)} /></div>
                <div className={styles.formRow}><label>Default sender email</label><input className={styles.formInput} value={defaultSenderEmail} onChange={(event) => setDefaultSenderEmail(event.target.value)} /></div>
              </div>
              <div className={styles.formGrid2}>
                <div className={styles.formRow}><label>Booking URL</label><input className={styles.formInput} value={bookingUrl} onChange={(event) => setBookingUrl(event.target.value)} /></div>
                <div className={styles.formRow}><label>Default CTA label</label><input className={styles.formInput} value={defaultCtaLabel} onChange={(event) => setDefaultCtaLabel(event.target.value)} /></div>
              </div>
              <div className={styles.formGrid2}>
                <div className={styles.formRow}><label>Default CTA URL</label><input className={styles.formInput} value={defaultCtaUrl} onChange={(event) => setDefaultCtaUrl(event.target.value)} /></div>
                <div className={styles.formRow}><label>Follow-up SLA (hours)</label><input className={styles.formInput} value={followupHours} onChange={(event) => setFollowupHours(event.target.value)} /></div>
              </div>
              <div className={styles.formGrid2}>
                <div className={styles.formRow}><label>Hot lead score threshold</label><input className={styles.formInput} value={hotLeadScore} onChange={(event) => setHotLeadScore(event.target.value)} /></div>
                <div className={styles.formRow}><label>Pipeline stages (comma separated)</label><input className={styles.formInput} value={pipelineStages} onChange={(event) => setPipelineStages(event.target.value)} /></div>
              </div>
              {setupNotice ? <div className={styles.licenseNotice}><Check size={15} /><span>{setupNotice}</span></div> : null}
              <div className={styles.licenseActions}>
                <button className={styles.btnPrimary} onClick={saveSetupConfig} disabled={setupSaving}>{setupSaving ? 'Saving...' : 'Save setup defaults'}</button>
                {showOnboardingWizard ? (
                  <button className={styles.btnSecondary} onClick={() => setOnboardingStep((current) => Math.min(onboardingSteps.length - 1, current + 1))}>
                    Next step
                  </button>
                ) : null}
                {showOnboardingWizard ? (
                  <button className={styles.btnSecondary} onClick={() => setOnboardingStep((current) => Math.max(0, current - 1))} disabled={onboardingStep === 0}>
                    Previous
                  </button>
                ) : null}
                {showOnboardingWizard ? (
                  <button className={styles.btnSecondary} onClick={completeOnboarding}>
                    Mark onboarding complete
                  </button>
                ) : null}
                <button className={styles.btnSecondary} onClick={() => {
                  setCompanyName('Online2Day')
                  setDefaultSenderName('Online2Day Team')
                  setDefaultSenderEmail('info@online2day.com')
                  setBookingUrl('https://calendly.com/online2day/demo')
                  setDefaultCtaLabel('Book a call')
                  setDefaultCtaUrl('https://calendly.com/online2day/demo')
                  setTimezone('Europe/London')
                  setFollowupHours('24')
                  setHotLeadScore('80')
                  setPipelineStages('New, Contacted, Qualified, Proposal Sent, Negotiation, Won')
                  setSetupNotice('Setup defaults reset locally. Save to apply.')
                }}>Reset defaults</button>
              </div>
            </div>
          </section>
        ) : activeTab === 'appearance' ? (
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
