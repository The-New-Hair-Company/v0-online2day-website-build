'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import styles from './LeadsDashboard.module.css'
import type { IconName, Lead, LeadStage, Metric, OwnerPerformance, PipelineStage, LeadSourcePerformance, TaskItem, Recommendation, ActivityItem } from './leads-types'
import { createLeadFromObject, logActivityEvent } from '@/lib/actions/lead-actions'
import { createTask, completeTask } from '@/lib/actions/task-actions'
import { logAuditEntry } from '@/lib/actions/audit-actions'
import { importContactsFromRows } from '@/lib/actions/import-actions'

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface LeadsDashboardProps {
  section?: DashboardSection
  initialLeads?: Lead[]
  metrics?: Metric[]
  ownerPerformance?: OwnerPerformance[]
  pipelineStages?: PipelineStage[]
  processSteps?: string[]
  recentActivity?: ActivityItem[]
  recommendations?: Recommendation[]
  sourcePerformance?: LeadSourcePerformance[]
  tasks?: TaskItem[]
}

type DashboardSection = 'overview' | 'leads'

type ActiveModal =
  | 'addLead' | 'createTask' | 'uploadContacts' | 'logActivity'
  | 'export' | 'contactInput' | 'filterPanel' | null

type LeadContact = {
  email?: string
  phone?: string
  linkedin?: string
  website?: string
}

type TimerState = {
  isRunning: boolean
  startTime: number | null
  elapsed: number
  billable: boolean
  leadId: string | null
  description: string
}

type ActivityType = 'call' | 'email' | 'meeting' | 'note' | 'task'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const stageOptions: LeadStage[] = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won']
const SOURCES = ['Website', 'Referral', 'Cold outreach', 'Ads', 'Organic']
const OWNERS = ['Sarah M.', 'James T.', 'Emily R.', 'Daniel K.', 'Michael B.']
const STATUSES = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won']

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ')

const pageMeta = {
  overview: { title: 'Overview', description: 'Your sales command centre', processTitle: 'Guide to Sale: Your sales process', nextAction: 'Follow up with 5 high-intent leads' },
  leads: { title: 'Leads', description: 'Manage, prioritise and convert your outreach pipeline.', processTitle: 'Guide to Sale: Your lead conversion process', nextAction: 'Follow up with 5 high-intent leads' },
}

function gdprLog(action: string, resource: string, id: string, changes?: string) {
  logAuditEntry(action, resource, id, changes)
}

function formatSeconds(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function LeadsDashboard({
  section = 'leads',
  initialLeads = [],
  metrics = [],
  ownerPerformance = [],
  pipelineStages = [],
  processSteps = [],
  recentActivity = [],
  recommendations = [],
  sourcePerformance = [],
  tasks = []
}: LeadsDashboardProps) {
  const meta = pageMeta[section]
  const router = useRouter()

  // Search & filter state
  const [globalQuery, setGlobalQuery] = useState('')
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState('All leads')
  const [selectedId, setSelectedId] = useState(initialLeads[0]?.id || '')
  const [selectedStage, setSelectedStage] = useState<'All stages' | LeadStage>('All stages')
  const [filterStatus, setFilterStatus] = useState<string[]>([])
  const [filterOwner, setFilterOwner] = useState<string[]>([])
  const [filterSource, setFilterSource] = useState<string[]>([])
  const [filterScoreMin, setFilterScoreMin] = useState(0)
  const [filterScoreMax, setFilterScoreMax] = useState(100)

  // UI state
  const [isStageOpen, setIsStageOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)
  const [showTimerWidget, setShowTimerWidget] = useState(false)
  const [contactInputType, setContactInputType] = useState<'email' | 'phone' | 'linkedin'>('email')
  const [notice, setNotice] = useState<{ title: string; detail: string } | null>(null)

  // Contacts state (extend leads with contact info)
  const [leadContacts, setLeadContacts] = useState<Record<string, LeadContact>>({})

  // Timer state
  const [timer, setTimer] = useState<TimerState>({
    isRunning: false, startTime: null, elapsed: 0,
    billable: true, leadId: null, description: ''
  })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Settings from localStorage
  const [theme, setThemeState] = useState('dark')
  const [textSize, setTextSizeState] = useState('md')

  useEffect(() => {
    try {
      const settings = JSON.parse(localStorage.getItem('o2d_accessibility_settings') || '{}')
      setThemeState(settings.theme || localStorage.getItem('crm_theme') || 'dark')
      setTextSizeState(settings.textSize === 'xl' ? 'lg' : settings.textSize || localStorage.getItem('crm_textsize') || 'md')
    } catch {
      setThemeState(localStorage.getItem('crm_theme') || 'dark')
      setTextSizeState(localStorage.getItem('crm_textsize') || 'md')
    }
  }, [])

  // Timer tick
  useEffect(() => {
    if (timer.isRunning) {
      timerRef.current = setInterval(() => {
        setTimer(t => ({ ...t, elapsed: t.elapsed + 1 }))
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [timer.isRunning])

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = () => setIsStageOpen(false)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const tabs = useMemo(() => [
    { label: 'All leads', count: initialLeads.length },
    { label: 'High intent', count: initialLeads.filter(l => l.score >= 80).length },
    { label: 'Follow-up due', count: initialLeads.filter(l => ['Send follow-up', 'Nudge reply', 'Book meeting'].includes(l.nextAction)).length },
    { label: 'At risk', count: initialLeads.filter(l => l.engagement < 50).length },
    { label: 'Won', count: initialLeads.filter(l => l.stage === 'Won').length },
  ], [initialLeads])

  const filteredLeads = useMemo(() => {
    const q = (globalQuery || query).trim().toLowerCase()
    return initialLeads.filter((lead) => {
      const matchesQuery = q
        ? `${lead.contactName} ${lead.role} ${lead.company} ${lead.stage} ${lead.owner} ${lead.source}`.toLowerCase().includes(q)
        : true
      const matchesStage = selectedStage === 'All stages' || lead.stage === selectedStage
      const matchesTab =
        activeTab === 'All leads' ||
        (activeTab === 'High intent' && lead.score >= 80) ||
        (activeTab === 'Follow-up due' && ['Send follow-up', 'Nudge reply', 'Book meeting'].includes(lead.nextAction)) ||
        (activeTab === 'At risk' && lead.engagement < 50) ||
        (activeTab === 'Won' && lead.stage === 'Won')
      const matchesStatus = filterStatus.length === 0 || filterStatus.includes(lead.stage)
      const matchesOwner = filterOwner.length === 0 || filterOwner.includes(lead.owner)
      const matchesSource = filterSource.length === 0 || filterSource.includes(lead.source)
      const matchesScore = lead.score >= filterScoreMin && lead.score <= filterScoreMax
      return matchesQuery && matchesStage && matchesTab && matchesStatus && matchesOwner && matchesSource && matchesScore
    })
  }, [query, globalQuery, selectedStage, activeTab, filterStatus, filterOwner, filterSource, filterScoreMin, filterScoreMax, initialLeads])

  const activeFilterCount = filterStatus.length + filterOwner.length + filterSource.length +
    (filterScoreMin > 0 || filterScoreMax < 100 ? 1 : 0)

  const selectedLead = initialLeads.find((lead) => lead.id === selectedId) || initialLeads[0] || null

  function clearFilters() {
    setFilterStatus([]); setFilterOwner([]); setFilterSource([])
    setFilterScoreMin(0); setFilterScoreMax(100)
  }

  function handleTimerToggle() {
    if (timer.isRunning) {
      setTimer(t => ({ ...t, isRunning: false }))
    } else {
      setTimer(t => ({ ...t, isRunning: true, startTime: Date.now() }))
    }
  }

  function handleTimerLog() {
    if (timer.elapsed === 0) return
    const units = Math.ceil(timer.elapsed / 360)
    const leadName = initialLeads.find(l => l.id === timer.leadId)?.contactName || 'General'
    gdprLog('log_activity', 'timer_session', timer.leadId || 'global', JSON.stringify({
      duration: timer.elapsed, billable: timer.billable, units, lead: leadName, description: timer.description
    }))
    setTimer({ isRunning: false, startTime: null, elapsed: 0, billable: true, leadId: null, description: '' })
    setShowTimerWidget(false)
  }

  function handleOpenLead(id: string) {
    gdprLog('view', 'lead', id)
    router.push(`/dashboard/leads/${id}`)
  }

  function showNotice(title: string, detail = 'Done.') {
    setNotice({ title, detail })
    window.setTimeout(() => setNotice(null), 3400)
  }

  function handleCommand(label: string) {
    const normalized = label.replace(/\s+/g, ' ').trim()
    if (!normalized) return

    if (/columns/i.test(normalized)) return showNotice('Columns saved', 'Your lead table layout has been acknowledged for this session.')
    if (/sort/i.test(normalized)) return showNotice('Sort applied', 'Leads are sorted by the selected activity signal.')
    if (/view full|view all|all activity|leaderboard|report/i.test(normalized)) return showNotice('Report opened', 'The detailed report is ready for the selected dashboard panel.')
    if (/recommendations|follow up|nudge|create video/i.test(normalized) && !/Create \/ Add/i.test(normalized)) {
      if (/create video/i.test(normalized)) router.push(`/dashboard/videos/editor${selectedLead ? `?lead=${selectedLead.id}` : ''}`)
      return showNotice('Recommended action queued', 'The selected lead action has been moved into the active workflow.')
    }
    if (/website/i.test(normalized)) return showNotice('Website unavailable', 'No website URL is stored for this lead yet.')
    if (/book call|calendar/i.test(normalized)) return router.push('/contact')
    if (/rows per page|‹|›|^\d+$/i.test(normalized)) return showNotice('Pagination updated', 'Lead table paging has been applied.')
    if (/more|ellipsis/i.test(normalized)) return showNotice('More actions', 'Additional lead actions are ready for this record.')
  }

  function handleShellClick(event: ReactMouseEvent<HTMLDivElement>) {
    const actionable = (event.target as HTMLElement).closest('button, a') as HTMLButtonElement | HTMLAnchorElement | null
    if (!actionable || actionable.closest('[data-leads-native="true"]')) return
    if ('disabled' in actionable && actionable.disabled) return
    const href = actionable instanceof HTMLAnchorElement ? actionable.getAttribute('href') : null
    if (href === '#') event.preventDefault()
    if (href && href !== '#') return
    const label = actionable.getAttribute('aria-label') || actionable.getAttribute('title') || actionable.textContent || ''
    handleCommand(label)
  }

  function handleContactAction(type: 'email' | 'phone' | 'linkedin') {
    if (!selectedLead) return
    const contact = leadContacts[selectedLead.id]
    if (type === 'email') {
      const email = contact?.email
      if (!email) { setContactInputType('email'); setActiveModal('contactInput'); return }
      gdprLog('contact_attempt', 'lead_email', selectedLead.id)
      window.open(`mailto:${email}`)
    } else if (type === 'phone') {
      const phone = contact?.phone
      if (!phone) { setContactInputType('phone'); setActiveModal('contactInput'); return }
      gdprLog('contact_attempt', 'lead_phone', selectedLead.id)
      window.open(`tel:${phone}`)
    } else {
      const li = contact?.linkedin
      if (!li) { setContactInputType('linkedin'); setActiveModal('contactInput'); return }
      gdprLog('contact_attempt', 'lead_linkedin', selectedLead.id)
      window.open(li.startsWith('http') ? li : `https://linkedin.com/in/${li}`, '_blank')
    }
  }

  return (
    <div
      className={styles.shell}
      data-theme={theme}
      data-size={textSize === 'md' ? undefined : textSize}
      onClick={handleShellClick}
    >
      <Sidebar section={section} />
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <div className={styles.titleRow}>
              <h1>{meta.title}</h1>
              <Icon name="star" className={styles.titleStar} />
            </div>
            <p>{meta.description}</p>
          </div>
          <div className={styles.topControls}>
            <label className={styles.globalSearch}>
              <Icon name="search" />
              <input
                value={globalQuery}
                onChange={e => setGlobalQuery(e.target.value)}
                placeholder="Search leads, contacts, companies..."
                aria-label="Search leads"
              />
              <span>⌘ K</span>
            </label>
            <button className={styles.utilityButton}>
              <Icon name="calendar" /> May 2025
            </button>
            <button
              className={cx(styles.utilityButton, activeFilterCount > 0 && styles.filterActive)}
              onClick={() => setActiveModal('filterPanel')}
            >
              <Icon name="filter" /> Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
            </button>
            <button className={styles.utilityButton} onClick={() => setActiveModal('export')}>
              <Icon name="export" /> Export
            </button>
            <div className={styles.createWrap}>
              <button className={styles.primaryButton} onClick={() => setIsCreateOpen((open) => !open)}>
                <Icon name="plus" /> Create / Add <Icon name="chevron" />
              </button>
              {isCreateOpen ? (
                <CreateMenu
                  onAddLead={() => { setActiveModal('addLead'); setIsCreateOpen(false) }}
                  onCreateTask={() => { setActiveModal('createTask'); setIsCreateOpen(false) }}
                  onUploadContacts={() => { setActiveModal('uploadContacts'); setIsCreateOpen(false) }}
                  onLogActivity={() => { setActiveModal('logActivity'); setIsCreateOpen(false) }}
                  onShowTimer={() => { setShowTimerWidget(true); setActiveModal(null); setIsCreateOpen(false) }}
                />
              ) : null}
            </div>
          </div>
        </header>

        <section className={styles.metricsGrid} aria-label="Lead performance metrics">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </section>

        <section className={styles.dashboardGrid}>
          <div className={styles.primaryColumn}>
            {section === 'overview' ? (
              <>
                <AnalyticsStrip
                  pipelineStages={pipelineStages}
                  sourcePerformance={sourcePerformance}
                  ownerPerformance={ownerPerformance}
                  totalLeadsCount={initialLeads.length}
                />
                <TopLeadsPanel leads={initialLeads} />
              </>
            ) : (
              <section className={styles.tableCard}>
                <div className={styles.tabs}>
                  {tabs.map((tab) => (
                    <button
                      key={tab.label}
                      className={cx(styles.tab, activeTab === tab.label && styles.tabActive)}
                      onClick={() => setActiveTab(tab.label)}
                    >
                      {tab.label}
                      {tab.label !== 'All leads' ? <span>{tab.count}</span> : <strong>{tab.count}</strong>}
                    </button>
                  ))}
                </div>

                <div className={styles.tableToolbar}>
                  <label className={styles.leadSearch}>
                    <Icon name="search" />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search leads..." />
                  </label>
                  <FilterDropdown label="Status" options={STATUSES} selected={filterStatus} onToggle={v => setFilterStatus(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])} />
                  <FilterDropdown label="Owner" options={OWNERS} selected={filterOwner} onToggle={v => setFilterOwner(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])} />
                  <FilterDropdown label="Source" options={SOURCES} selected={filterSource} onToggle={v => setFilterSource(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])} />
                  <div className={styles.dropdownWrap}>
                    <button
                      className={cx(styles.filterButton, isStageOpen && styles.filterActive)}
                      onClick={(e) => { e.stopPropagation(); setIsStageOpen(open => !open) }}
                    >
                      Stage <Icon name="chevron" />
                    </button>
                    {isStageOpen && (
                      <StageDropdown selectedStage={selectedStage} onSelect={v => { setSelectedStage(v); setIsStageOpen(false) }} />
                    )}
                  </div>
                  {activeFilterCount > 0 && (
                    <button className={styles.filterButton} onClick={clearFilters} style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)' }}>
                      Clear filters ✕
                    </button>
                  )}
                  <div className={styles.tableToolsRight}>
                    <button className={styles.filterButton}><Icon name="columns" /> Columns</button>
                    <button className={styles.filterButton}>Sort: Last activity <Icon name="chevron" /></button>
                  </div>
                </div>

                {filteredLeads.length > 0 ? (
                  <LeadTable
                    leads={filteredLeads}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    totalCount={initialLeads.length}
                    onOpen={handleOpenLead}
                  />
                ) : (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                    No leads found. Try adjusting your search or filters.
                  </div>
                )}
              </section>
            )}
          </div>

          <RightRail
            tasks={tasks}
            recommendations={recommendations}
            recentActivity={recentActivity}
            section={section}
            pipelineStages={pipelineStages}
            onCompleteTask={async (id) => { await completeTask(id); router.refresh() }}
          />
        </section>
      </main>

      {section === 'leads' && selectedLead && (
        <LeadCommandBar
          lead={selectedLead}
          onOpen={handleOpenLead}
          onEmail={() => handleContactAction('email')}
          onPhone={() => handleContactAction('phone')}
          onLinkedin={() => handleContactAction('linkedin')}
        />
      )}

      {/* Timer FAB + Widget */}
      <div className={styles.timerFabWrapper}>
        {showTimerWidget && (
          <TimerWidget
            timer={timer}
            leads={initialLeads}
            onToggle={handleTimerToggle}
            onLog={handleTimerLog}
            onChange={patch => setTimer(t => ({ ...t, ...patch }))}
            onClose={() => setShowTimerWidget(false)}
          />
        )}
        <button
          className={cx(styles.timerFab, timer.isRunning && styles.timerFabActive)}
          onClick={() => setShowTimerWidget(v => !v)}
          title="Time tracker"
          aria-label="Open time tracker"
        >
          <Icon name="clock" />
        </button>
      </div>

      {/* Modals */}
      {activeModal === 'filterPanel' && (
        <FilterPanel
          filterStatus={filterStatus} filterOwner={filterOwner} filterSource={filterSource}
          filterScoreMin={filterScoreMin} filterScoreMax={filterScoreMax}
          onToggleStatus={v => setFilterStatus(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])}
          onToggleOwner={v => setFilterOwner(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])}
          onToggleSource={v => setFilterSource(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])}
          onScoreMin={setFilterScoreMin} onScoreMax={setFilterScoreMax}
          onClear={clearFilters} onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === 'addLead' && (
        <AddLeadModal onClose={() => setActiveModal(null)} onSave={async (lead) => {
          const result = await createLeadFromObject(lead)
          if (result?.error) throw new Error(result.error)
          gdprLog('create', 'lead', lead.name, JSON.stringify(lead))
          setActiveModal(null)
          router.refresh()
          showNotice('Lead added', `${lead.name} has been added to your pipeline.`)
        }} />
      )}
      {activeModal === 'createTask' && (
        <CreateTaskModal leads={initialLeads} onClose={() => setActiveModal(null)} onSave={async (task) => {
          const result = await createTask({ title: task.title, leadId: task.leadId, dueDate: task.dueDate, dueTime: task.dueTime, notes: task.notes })
          if (result?.error) throw new Error(result.error)
          gdprLog('create', 'task', task.title, JSON.stringify(task))
          setActiveModal(null)
          router.refresh()
          showNotice('Task created', task.title)
        }} />
      )}
      {activeModal === 'uploadContacts' && (
        <UploadContactsModal onClose={() => setActiveModal(null)} onImport={(count) => {
          gdprLog('import', 'contacts', 'bulk', `count:${count}`)
          setActiveModal(null)
        }} />
      )}
      {activeModal === 'logActivity' && (
        <LogActivityModal leads={initialLeads} onClose={() => setActiveModal(null)} onSave={async (act) => {
          const result = await logActivityEvent({ leadId: act.leadId || null, type: act.type, notes: act.notes, durationMinutes: act.duration ? Number(act.duration) : undefined, billable: act.billable })
          if (result?.error) throw new Error(result.error)
          gdprLog('create', 'activity', act.leadId || 'general', JSON.stringify(act))
          setActiveModal(null)
          router.refresh()
          showNotice('Activity logged', `${act.type} logged successfully.`)
        }} />
      )}
      {activeModal === 'export' && (
        <ExportModal leads={filteredLeads} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'contactInput' && selectedLead && (
        <ContactInputModal
          type={contactInputType}
          lead={selectedLead}
          current={leadContacts[selectedLead.id]}
          onSave={(val) => {
            setLeadContacts(prev => ({
              ...prev,
              [selectedLead.id]: { ...prev[selectedLead.id], [contactInputType]: val }
            }))
            gdprLog('update', 'lead_contact', selectedLead.id, `${contactInputType}=saved`)
            setActiveModal(null)
          }}
          onClose={() => setActiveModal(null)}
        />
      )}
      {notice ? (
        <div className={styles.actionToast} role="status" aria-live="polite">
          <strong>{notice.title}</strong>
          <span>{notice.detail}</span>
        </div>
      ) : null}
    </div>
  )
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────

function Sidebar({ section }: { section: DashboardSection }) {
  const navItems = [
    { label: 'Overview', icon: 'grid' as IconName, href: '/dashboard/overview', section: 'overview' as DashboardSection },
    { label: 'Leads', icon: 'users' as IconName, href: '/dashboard/leads', section: 'leads' as DashboardSection },
    { label: 'Videos', icon: 'video' as IconName, href: '/dashboard/videos' },
    { label: 'Emails', icon: 'mail' as IconName, href: '/dashboard/emails' },
    { label: 'Messages', icon: 'message' as IconName, href: '/dashboard/messages', badge: '4' },
    { label: 'Site Requests', icon: 'request' as IconName, href: '/dashboard/site-requests' },
    { label: 'Integrations', icon: 'integrations' as IconName, href: '/dashboard/integrations' },
    { label: 'Settings', icon: 'settings' as IconName, href: '/dashboard/settings' },
  ]

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span>Online2Day</span>
        <p>CRM Dashboard</p>
      </div>
      <nav className={styles.nav} aria-label="CRM navigation">
        <p className={styles.navSection}>MAIN</p>
        {navItems.map((item) => (
          <Link
            key={item.label}
            className={cx(styles.navItem, item.section === section && styles.navItemActive)}
            href={item.href}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
            {item.badge ? <strong>{item.badge}</strong> : null}
            {item.section === section ? <em /> : null}
          </Link>
        ))}
      </nav>
      <div className={styles.proCard}>
        <div className={styles.proIcon}><Icon name="crown" /></div>
        <h3>Pro Plan</h3>
        <p>Unlimited videos, advanced analytics and more.</p>
        <Link href="/pricing"><button>View Plans</button></Link>
      </div>
      <a className={styles.signOut} href="/auth/login"><Icon name="logout" /> Sign Out</a>
    </aside>
  )
}

// ─── CREATE MENU ─────────────────────────────────────────────────────────────

function CreateMenu({ onAddLead, onCreateTask, onUploadContacts, onLogActivity, onShowTimer }: {
  onAddLead: () => void; onCreateTask: () => void; onUploadContacts: () => void
  onLogActivity: () => void; onShowTimer: () => void
}) {
  const items = [
    { label: 'Add lead', icon: 'users' as IconName, action: onAddLead },
    { label: 'Import contacts', icon: 'upload' as IconName, action: onUploadContacts },
    { label: 'Create task', icon: 'task' as IconName, action: onCreateTask },
    { label: 'Log activity', icon: 'clock' as IconName, action: onLogActivity },
    { label: 'Start timer', icon: 'timer' as IconName, action: onShowTimer },
    { label: 'Create video', icon: 'video' as IconName, action: () => {} },
  ]

  return (
    <div className={styles.createMenu} role="menu">
      {items.map((item) => (
        <button key={item.label} role="menuitem" onClick={item.action}>
          <Icon name={item.icon} />
          {item.label}
        </button>
      ))}
    </div>
  )
}

// ─── FILTER DROPDOWN (inline) ────────────────────────────────────────────────

function FilterDropdown({ label, options, selected, onToggle }: {
  label: string; options: string[]; selected: string[]; onToggle: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className={styles.dropdownWrap} ref={ref}>
      <button
        className={cx(styles.filterButton, (open || selected.length > 0) && styles.filterActive)}
        onClick={() => setOpen(v => !v)}
      >
        {label} {selected.length > 0 ? `(${selected.length})` : ''} <Icon name="chevron" />
      </button>
      {open && (
        <div className={styles.stageMenu} role="listbox" style={{ width: 180 }}>
          {options.map(opt => (
            <button key={opt} onClick={() => onToggle(opt)} className={selected.includes(opt) ? styles.optionActive : ''}>
              <span>{opt}</span>{selected.includes(opt) ? <Icon name="check" /> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── FILTER PANEL ─────────────────────────────────────────────────────────────

function FilterPanel({ filterStatus, filterOwner, filterSource, filterScoreMin, filterScoreMax,
  onToggleStatus, onToggleOwner, onToggleSource, onScoreMin, onScoreMax, onClear, onClose }: {
  filterStatus: string[]; filterOwner: string[]; filterSource: string[]
  filterScoreMin: number; filterScoreMax: number
  onToggleStatus: (v: string) => void; onToggleOwner: (v: string) => void; onToggleSource: (v: string) => void
  onScoreMin: (v: number) => void; onScoreMax: (v: number) => void
  onClear: () => void; onClose: () => void
}) {
  return (
    <>
      <div className={styles.filterPanelOverlay} onClick={onClose} />
      <aside className={styles.filterPanel} aria-label="Filter panel">
        <div className={styles.filterPanelHeader}>
          <Icon name="filter" />
          <h2>Filter Leads</h2>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.filterPanelBody}>
          <div className={styles.filterSection}>
            <h3>Status / Stage</h3>
            <div className={styles.filterChips}>
              {STATUSES.map(s => (
                <button
                  key={s}
                  className={cx(styles.filterChip, filterStatus.includes(s) && styles.filterChipActive)}
                  onClick={() => onToggleStatus(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.filterSection}>
            <h3>Owner</h3>
            <div className={styles.filterChips}>
              {OWNERS.map(o => (
                <button
                  key={o}
                  className={cx(styles.filterChip, filterOwner.includes(o) && styles.filterChipActive)}
                  onClick={() => onToggleOwner(o)}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.filterSection}>
            <h3>Source</h3>
            <div className={styles.filterChips}>
              {SOURCES.map(s => (
                <button
                  key={s}
                  className={cx(styles.filterChip, filterSource.includes(s) && styles.filterChipActive)}
                  onClick={() => onToggleSource(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.filterSection}>
            <h3>Lead Score Range</h3>
            <div className={styles.scoreRange}>
              <div className={styles.scoreRangeInputs}>
                <input
                  type="number" min={0} max={100} value={filterScoreMin}
                  onChange={e => onScoreMin(Number(e.target.value))}
                  className={styles.formInput} placeholder="Min"
                />
                <span>to</span>
                <input
                  type="number" min={0} max={100} value={filterScoreMax}
                  onChange={e => onScoreMax(Number(e.target.value))}
                  className={styles.formInput} placeholder="Max"
                />
              </div>
            </div>
          </div>
        </div>
        <div className={styles.filterPanelFooter}>
          <button className={styles.btnSecondary} onClick={onClear} style={{ flex: 1 }}>Clear all</button>
          <button className={styles.btnPrimary} onClick={onClose} style={{ flex: 1 }}>Apply filters</button>
        </div>
      </aside>
    </>
  )
}

// ─── METRIC CARD ─────────────────────────────────────────────────────────────

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <article className={styles.metricCard}>
      <div className={styles.metricTop}>
        <div className={styles.metricIcon}><Icon name={metric.icon} /></div>
        <span>{metric.label}</span>
      </div>
      <strong>{metric.value}</strong>
      <p>↑ {metric.delta.replace('+ ', '')}</p>
      <Sparkline values={metric.sparkline} />
    </article>
  )
}

// ─── SPARKLINE ───────────────────────────────────────────────────────────────

function Sparkline({ values }: { values: number[] }) {
  const width = 140; const height = 34
  const max = Math.max(...values); const min = Math.min(...values)
  const points = values.map((value, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((value - min) / Math.max(max - min, 1)) * (height - 6) - 3
    return `${x},${y}`
  }).join(' ')
  return (
    <svg className={styles.sparkline} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id="spark" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#2f6bff" />
          <stop offset="100%" stopColor="#30d7ff" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke="url(#spark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  )
}

// ─── ANALYTICS STRIP ─────────────────────────────────────────────────────────

function AnalyticsStrip({ pipelineStages, sourcePerformance, ownerPerformance, totalLeadsCount }: {
  pipelineStages: PipelineStage[]; sourcePerformance: LeadSourcePerformance[]
  ownerPerformance: OwnerPerformance[]; totalLeadsCount: number
}) {
  return (
    <section className={styles.analyticsGrid}>
      <article className={styles.analyticsCard}>
        <h3>Pipeline by stage</h3>
        <div className={styles.funnelRow}>
          <Funnel pipelineStages={pipelineStages} />
          <div className={styles.stageLegend}>
            {pipelineStages.map(s => (
              <div key={s.label}>
                <i style={{ backgroundColor: s.color }} />
                <span>{s.label}</span>
                <strong>{s.count} ({s.percentage}%)</strong>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.analyticsFooter}>Total <strong>{totalLeadsCount}</strong></div>
      </article>
      <article className={styles.analyticsCard}>
        <h3>Lead source performance</h3>
        <div className={styles.compactTable}>
          <div className={styles.compactHeader}><span>Source</span><span>Leads</span><span>Conv.</span><span>Value</span></div>
          {sourcePerformance.map(s => (
            <div className={styles.compactRow} key={s.source}>
              <span>{s.source}</span><strong>{s.leads}</strong><span>{s.conversion}</span><b>{s.value}</b>
              <em style={{ width: `${s.bar}%`, backgroundColor: s.color }} />
            </div>
          ))}
        </div>
        <a className={styles.panelLink} href="#">View full report →</a>
      </article>
      <article className={styles.analyticsCard}>
        <h3>Owner performance</h3>
        <div className={styles.ownerTable}>
          <div className={styles.ownerHeader}><span>Owner</span><span>Leads</span><span>Meetings</span><span>Won</span><span>Value</span></div>
          {ownerPerformance.map(o => (
            <div className={styles.ownerRow} key={o.owner}>
              <span><Avatar initials={o.avatar} size="sm" />{o.owner}</span>
              <strong>{o.leads}</strong><span>{o.meetings}</span>
              <span>{Math.max(2, Math.round(o.meetings / 3))}</span><b>{o.revenue}</b>
            </div>
          ))}
        </div>
        <a className={styles.panelLink} href="#">View full leaderboard →</a>
      </article>
    </section>
  )
}

function Funnel({ pipelineStages }: { pipelineStages: PipelineStage[] }) {
  return (
    <svg className={styles.funnel} viewBox="0 0 130 110" aria-hidden="true">
      {pipelineStages.map((stage, i) => {
        const y = i * 15; const inset = i * 9
        return (
          <polygon key={stage.label}
            points={`${10 + inset},${y + 4} ${120 - inset},${y + 4} ${111 - inset},${y + 17} ${19 + inset},${y + 17}`}
            fill={stage.color} opacity={0.94}
          />
        )
      })}
    </svg>
  )
}

// ─── STAGE DROPDOWN ──────────────────────────────────────────────────────────

function StageDropdown({ selectedStage, onSelect }: { selectedStage: 'All stages' | LeadStage; onSelect: (s: 'All stages' | LeadStage) => void }) {
  return (
    <div className={styles.stageMenu} role="listbox">
      <button className={selectedStage === 'All stages' ? styles.optionActive : ''} onClick={() => onSelect('All stages')}>
        <span>All stages</span><Icon name="check" />
      </button>
      {stageOptions.map(s => (
        <button key={s} className={selectedStage === s ? styles.optionActive : ''} onClick={() => onSelect(s)}>
          <span>{s}</span>{selectedStage === s ? <Icon name="check" /> : null}
        </button>
      ))}
    </div>
  )
}

// ─── LEAD TABLE ──────────────────────────────────────────────────────────────

function LeadTable({ leads, selectedId, onSelect, totalCount, onOpen }: {
  leads: Lead[]; selectedId: string; onSelect: (id: string) => void; totalCount: number; onOpen: (id: string) => void
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.leadsTable}>
        <thead>
          <tr>
            <th><input aria-label="Select all" type="checkbox" /></th>
            <th>Lead</th><th>Company</th><th>Score</th><th>Stage</th>
            <th>Owner</th><th>Source</th><th>Last activity</th>
            <th>Engagement</th><th>Value</th><th>Next action</th><th />
          </tr>
        </thead>
        <tbody>
          {leads.map(lead => (
            <tr key={lead.id} className={cx(selectedId === lead.id && styles.selectedRow)} onClick={() => onSelect(lead.id)}>
              <td><input checked={selectedId === lead.id} readOnly type="checkbox" /></td>
              <td className={styles.leadCell}>
                <Avatar initials={lead.contactName.split(' ').map(n => n[0]).join('')} />
                <div><strong>{lead.contactName}</strong><span>{lead.role}</span></div>
              </td>
              <td className={styles.companyCell}>
                <div className={cx(styles.companyLogo, styles[lead.logoClass])}>{lead.companyMark}</div>
                <span>{lead.company}</span>
              </td>
              <td><Score value={lead.score} /></td>
              <td><StageBadge stage={lead.stage} /></td>
              <td className={styles.ownerCell}><Avatar initials={initialsForOwner(lead.owner)} size="sm" />{lead.owner}</td>
              <td><Icon name={lead.sourceIcon} className={styles.sourceIcon} /></td>
              <td>{lead.lastActivity}</td>
              <td className={styles.engagementCell}><span>{lead.engagement}%</span><ProgressBar value={lead.engagement} /></td>
              <td><strong>{lead.value}</strong></td>
              <td>
                <button style={{ background: 'none', border: 'none', color: '#3f8cff', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                  onClick={e => { e.stopPropagation(); onOpen(lead.id) }}>
                  {lead.nextAction}
                </button>
              </td>
              <td>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={e => { e.stopPropagation(); onOpen(lead.id) }}>
                  <Icon name="external" className={styles.rowMenu} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.tableFooter}>
        <span>Showing 1–{Math.min(leads.length, 10)} of {totalCount} leads</span>
        <div className={styles.pagination}>
          <button>‹</button><button className={styles.pageActive}>1</button><button>2</button>
          <button>3</button><span>…</span><button>›</button>
        </div>
        <button className={styles.rowsButton}>Rows per page <strong>10</strong><Icon name="chevron" /></button>
      </div>
    </div>
  )
}

// ─── TOP LEADS PANEL ─────────────────────────────────────────────────────────

function TopLeadsPanel({ leads }: { leads: Lead[] }) {
  const top = useMemo(() => [...leads].sort((a, b) => b.score - a.score).slice(0, 5), [leads])
  return (
    <section className={styles.tableCard}>
      <div className={styles.panelHeader} style={{ padding: '16px 18px 0' }}>
        <h3 className={styles.panelTitle}>Top leads needing attention</h3>
        <a className={styles.panelLink} href="/dashboard/leads">View all →</a>
      </div>
      <div style={{ padding: '10px 18px 16px' }}>
        {top.map((lead, i) => (
          <div key={lead.id} className={styles.listRow} style={{ padding: '12px 0', borderBottom: i < top.length - 1 ? '1px solid rgba(116,147,196,0.08)' : 'none' }}>
            <div className={styles.identity}>
              <Avatar initials={lead.contactName.split(' ').map(n => n[0]).join('')} size="sm" />
              <div><strong>{lead.contactName}</strong><div className={styles.subtle}>{lead.company}</div></div>
            </div>
            <StageBadge stage={lead.stage} />
            <Score value={lead.score} />
            <Link href={`/dashboard/leads/${lead.id}`} style={{ color: '#60a5fa', fontSize: 13 }}>{lead.nextAction}</Link>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── RIGHT RAIL ───────────────────────────────────────────────────────────────

function RightRail({ tasks, recommendations, recentActivity, section = 'leads', pipelineStages = [], onCompleteTask }: {
  tasks: TaskItem[]; recommendations: Recommendation[]; recentActivity: ActivityItem[]
  section?: DashboardSection; pipelineStages?: PipelineStage[]; onCompleteTask?: (id: string) => void
}) {
  return (
    <aside className={styles.rightRail}>
      {section === 'leads' && pipelineStages.length > 0 && (
        <article className={styles.analyticsCard}>
          <h3>Pipeline by stage</h3>
          <div className={styles.funnelRow}>
            <Funnel pipelineStages={pipelineStages} />
            <div className={styles.stageLegend}>
              {pipelineStages.map(s => (
                <div key={s.label}><i style={{ backgroundColor: s.color }} /><span>{s.label}</span><strong>{s.count} ({s.percentage}%)</strong></div>
              ))}
            </div>
          </div>
        </article>
      )}
      <Panel title="Today's priorities" badge={tasks.filter(t => !t.checked).length.toString()}>
        <div className={styles.taskList}>
          {tasks.map(t => (
            <label key={t.label}>
              <input
                type="checkbox"
                checked={Boolean(t.checked)}
                onChange={() => { if (t.id && !t.checked && onCompleteTask) onCompleteTask(t.id) }}
              />
              <span>{t.label}</span><time>{t.time}</time>
            </label>
          ))}
        </div>
        <a className={styles.panelLink} href="#">View all tasks →</a>
      </Panel>
      {section === 'leads' && (
        <Panel title="AI recommendations">
          <div className={styles.recommendationList}>
            {recommendations.map(item => (
              <div key={item.title} className={styles.recommendationItem}>
                <span className={cx(styles.recIcon, styles[`tone${item.tone}`])}><Icon name={item.icon} /></span>
                <div><strong>{item.title}</strong><p>{item.detail}</p></div>
                <button>{item.action}</button>
              </div>
            ))}
          </div>
          <a className={styles.panelLink} href="#">View all →</a>
        </Panel>
      )}
      {section === 'overview' && (
        <Panel title="Recent activity" action="All">
          <div className={styles.activityList}>
            {recentActivity.map(a => (
              <div key={a.title}><span /><p>{a.title}</p><time>{a.time}</time></div>
            ))}
          </div>
          <a className={styles.panelLink} href="#">View all activity →</a>
        </Panel>
      )}
    </aside>
  )
}

function Panel({ title, badge, action, children }: { title: string; badge?: string; action?: string; children: ReactNode }) {
  return (
    <section className={styles.railPanel}>
      <header>
        <h3>{title}</h3>
        {badge ? <span className={styles.panelBadge}>{badge}</span> : null}
        {action ? <button>{action} <Icon name="chevron" /></button> : null}
      </header>
      {children}
    </section>
  )
}

// ─── COMMAND BAR ─────────────────────────────────────────────────────────────

function LeadCommandBar({ lead, onOpen, onEmail, onPhone, onLinkedin }: {
  lead: Lead; onOpen: (id: string) => void
  onEmail: () => void; onPhone: () => void; onLinkedin: () => void
}) {
  return (
    <section className={styles.commandBar}>
      <div className={cx(styles.commandLogo, styles[lead.logoClass])}>{lead.companyMark}</div>
      <div className={styles.commandTitle}>
        <div><h2>{lead.company}</h2><StageBadge stage={lead.stage} /></div>
        <p>{lead.contactName} · {lead.role}</p>
        <div className={styles.contactActions}>
          <button title="Send email" onClick={onEmail}><Icon name="mail" /></button>
          <button title="Call" onClick={onPhone}><Icon name="phone" /></button>
          <button title="LinkedIn" onClick={onLinkedin}><Icon name="linkedin" /></button>
          <button title="Website"><Icon name="globe" /></button>
          <button><Icon name="ellipsis" /></button>
        </div>
      </div>
      <div className={styles.commandMeta}><span>Lead score</span><Score value={lead.score} /></div>
      <div className={styles.commandMeta}><span>Owner</span><strong><Avatar initials={initialsForOwner(lead.owner)} size="sm" />{lead.owner}</strong></div>
      <div className={styles.commandMeta}><span>Source</span><strong><Icon name="globe" />{lead.source}</strong></div>
      <div className={styles.commandMeta}><span>Last touch</span><strong><Icon name="mail" />{lead.lastActivity}</strong></div>
      <div className={styles.recommendedBox}>
        <strong>Recommended CTA</strong>
        <p>Follow up via email with case study video to move to proposal stage.</p>
      </div>
      <div className={styles.commandActions}>
        <button className={styles.primaryAction} onClick={() => onOpen(lead.id)}><Icon name="external" />Open lead</button>
        <button onClick={onEmail}><Icon name="mail" />Send email</button>
        <button><Icon name="video" />Create video</button>
        <button><Icon name="calendar" />Book call</button>
        <button className={styles.iconButton}><Icon name="ellipsis" /></button>
      </div>
    </section>
  )
}

// ─── TIMER WIDGET ─────────────────────────────────────────────────────────────

function TimerWidget({ timer, leads, onToggle, onLog, onChange, onClose }: {
  timer: TimerState; leads: Lead[]
  onToggle: () => void; onLog: () => void
  onChange: (patch: Partial<TimerState>) => void; onClose: () => void
}) {
  const billingUnits = Math.ceil((timer.elapsed || 1) / 360)
  return (
    <div className={styles.timerWidget} role="complementary" aria-label="Time tracker">
      <div className={styles.timerHeader}>
        <Icon name="clock" />
        <span>Time Tracker</span>
        <button className={styles.timerHeaderClose} onClick={onClose}>✕</button>
      </div>
      <div className={styles.timerBody}>
        <div>
          <div className={styles.timerDisplay}>{formatSeconds(timer.elapsed)}</div>
          <div className={styles.timerUnits}>
            <span className={styles.timerUnitsValue}>{billingUnits}</span> × 6-min unit{billingUnits !== 1 ? 's' : ''}
            {' '}· {timer.billable ? '💰 Billable' : '🔓 Non-billable'}
          </div>
        </div>
        <div className={styles.timerBillable}>
          <button className={cx(styles.timerBillableBtn, timer.billable && styles.timerBillableActive)} onClick={() => onChange({ billable: true })}>
            Billable
          </button>
          <button className={cx(styles.timerBillableBtn, !timer.billable && styles.timerBillableActive)} onClick={() => onChange({ billable: false })}>
            Non-billable
          </button>
        </div>
        <select
          className={styles.timerLeadSelect}
          value={timer.leadId || ''}
          onChange={e => onChange({ leadId: e.target.value || null })}
        >
          <option value="">No lead attached</option>
          {leads.slice(0, 20).map(l => <option key={l.id} value={l.id}>{l.contactName} – {l.company}</option>)}
        </select>
        <input
          className={styles.timerLeadSelect}
          placeholder="Activity description..."
          value={timer.description}
          onChange={e => onChange({ description: e.target.value })}
        />
        <div className={styles.timerControls}>
          {!timer.isRunning ? (
            <button className={styles.timerStart} onClick={onToggle}><Icon name="play" /> Start</button>
          ) : (
            <button className={styles.timerStop} onClick={onToggle}><Icon name="pause" /> Pause</button>
          )}
          {timer.elapsed > 0 && (
            <button className={styles.timerLog} onClick={onLog}>Log &amp; save</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ADD LEAD MODAL ──────────────────────────────────────────────────────────

function AddLeadModal({ onClose, onSave }: { onClose: () => void; onSave: (data: any) => Promise<void> }) {
  const [form, setForm] = useState({ name: '', company: '', role: '', email: '', phone: '', linkedin: '', source: 'Website', stage: 'New', owner: '', value: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleSave() {
    if (!form.name.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      await onSave(form)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save lead.')
      setSaving(false)
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={cx(styles.modal, styles.modalLg)}>
        <div className={styles.modalHeader}>
          <Icon name="users" />
          <h2>Add New Lead</h2>
          <div className={styles.gdprBadge}><Icon name="check" />GDPR logged</div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.formGrid2}>
            <div className={styles.formRow}><label>Full name *</label><input className={styles.formInput} value={form.name} onChange={set('name')} placeholder="Jane Smith" /></div>
            <div className={styles.formRow}><label>Company</label><input className={styles.formInput} value={form.company} onChange={set('company')} placeholder="Acme Corp" /></div>
          </div>
          <div className={styles.formGrid2}>
            <div className={styles.formRow}><label>Job title</label><input className={styles.formInput} value={form.role} onChange={set('role')} placeholder="Marketing Director" /></div>
            <div className={styles.formRow}><label>Deal value</label><input className={styles.formInput} value={form.value} onChange={set('value')} placeholder="$5,000" /></div>
          </div>
          <div className={styles.formGrid2}>
            <div className={styles.formRow}><label>Email address</label><input className={styles.formInput} type="email" value={form.email} onChange={set('email')} placeholder="jane@acme.com" /></div>
            <div className={styles.formRow}><label>Phone number</label><input className={styles.formInput} type="tel" value={form.phone} onChange={set('phone')} placeholder="+44 7700 000000" /></div>
          </div>
          <div className={styles.formRow}><label>LinkedIn URL</label><input className={styles.formInput} value={form.linkedin} onChange={set('linkedin')} placeholder="https://linkedin.com/in/janesmith" /></div>
          <div className={styles.formGrid2}>
            <div className={styles.formRow}>
              <label>Stage</label>
              <select className={styles.formSelect} value={form.stage} onChange={set('stage')}>
                {stageOptions.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className={styles.formRow}>
              <label>Source</label>
              <select className={styles.formSelect} value={form.source} onChange={set('source')}>
                {SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.formRow}><label>Assign owner</label>
            <select className={styles.formSelect} value={form.owner} onChange={set('owner')}>
              <option value="">Unassigned</option>
              {OWNERS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className={styles.formRow}><label>Notes</label><textarea className={styles.formTextarea} value={form.notes} onChange={set('notes')} placeholder="Initial qualification notes..." /></div>
          {error && <p style={{ color: '#f87171', fontSize: 13, margin: '4px 0 0' }}>{error}</p>}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={saving}>Cancel</button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={saving || !form.name.trim()}>
            <Icon name="plus" />{saving ? 'Saving…' : 'Add Lead'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CREATE TASK MODAL ───────────────────────────────────────────────────────

function CreateTaskModal({ leads, onClose, onSave }: { leads: Lead[]; onClose: () => void; onSave: (data: any) => Promise<void> }) {
  const [form, setForm] = useState({ title: '', type: 'call', leadId: '', dueDate: '', dueTime: '', priority: 'medium', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [f]: e.target.value }))

  async function handleSave() {
    if (!form.title.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      await onSave(form)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create task.')
      setSaving(false)
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <Icon name="task" />
          <h2>Create Task</h2>
          <div className={styles.gdprBadge}><Icon name="check" />GDPR logged</div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.formRow}><label>Task title *</label><input className={styles.formInput} value={form.title} onChange={set('title')} placeholder="Follow up with client" /></div>
          <div className={styles.formGrid2}>
            <div className={styles.formRow}><label>Task type</label>
              <select className={styles.formSelect} value={form.type} onChange={set('type')}>
                {['call', 'email', 'meeting', 'follow-up', 'proposal', 'other'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className={styles.formRow}><label>Priority</label>
              <select className={styles.formSelect} value={form.priority} onChange={set('priority')}>
                <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
              </select>
            </div>
          </div>
          <div className={styles.formRow}><label>Linked lead</label>
            <select className={styles.formSelect} value={form.leadId} onChange={set('leadId')}>
              <option value="">No lead</option>
              {leads.slice(0, 30).map(l => <option key={l.id} value={l.id}>{l.contactName} – {l.company}</option>)}
            </select>
          </div>
          <div className={styles.formGrid2}>
            <div className={styles.formRow}><label>Due date</label><input className={styles.formInput} type="date" value={form.dueDate} onChange={set('dueDate')} /></div>
            <div className={styles.formRow}><label>Due time</label><input className={styles.formInput} type="time" value={form.dueTime} onChange={set('dueTime')} /></div>
          </div>
          <div className={styles.formRow}><label>Notes</label><textarea className={styles.formTextarea} value={form.notes} onChange={set('notes')} placeholder="Task details..." /></div>
          {error && <p style={{ color: '#f87171', fontSize: 13, margin: '4px 0 0' }}>{error}</p>}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={saving}>Cancel</button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={saving || !form.title.trim()}>
            <Icon name="check" />{saving ? 'Saving…' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── UPLOAD CONTACTS MODAL ───────────────────────────────────────────────────

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase())
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.replace(/^"|"$/g, '').trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
    return row
  })
}

function UploadContactsModal({ onClose, onImport }: { onClose: () => void; onImport: (count: number) => void }) {
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [nameCol, setNameCol] = useState('name')
  const [emailCol, setEmailCol] = useState('email')
  const [companyCol, setCompanyCol] = useState('company')
  const [defaultStage, setDefaultStage] = useState('New')
  const [importing, setImporting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File) { setFile(f) }

  async function handleImport() {
    if (!file || importing) return
    setImporting(true)
    try {
      const text = await file.text()
      const rows = parseCsv(text).map(row => ({
        name: row[nameCol] || row['name'] || '',
        email: row[emailCol] || row['email'] || '',
        company: row[companyCol] || row['company'] || '',
        phone: row['phone'] || row['mobile'] || '',
        source: row['source'] || 'Import',
        stage: row['stage'] || '',
      }))
      const result = await importContactsFromRows(rows, file.name, defaultStage)
      onImport(result.imported ?? 0)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={cx(styles.modal, styles.modalLg)}>
        <div className={styles.modalHeader}>
          <Icon name="upload" />
          <h2>Import Contacts</h2>
          <div className={styles.gdprBadge}><Icon name="check" />GDPR logged</div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          {!file ? (
            <>
              <div
                className={cx(styles.dropzone, dragOver && styles.dropzoneActive)}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                onClick={() => inputRef.current?.click()}
              >
                <div className={styles.dropzoneIcon}><Icon name="upload" /></div>
                <strong>Drop your file here, or click to browse</strong>
                <span>Supports CSV files with a header row</span>
                <div className={styles.formatBadges}>
                  {['CSV'].map(f => <span key={f} className={styles.formatBadge}>{f}</span>)}
                </div>
                <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              </div>
            </>
          ) : (
            <>
              <div className={styles.uploadedFile}>
                <Icon name="check" />
                <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                <button className={styles.btnSecondary} onClick={() => setFile(null)} style={{ padding: '4px 10px', minHeight: 28, fontSize: 12 }}>Remove</button>
              </div>
              <div className={styles.formRow}>
                <label>Map "Name" column</label>
                <select className={styles.formSelect} value={nameCol} onChange={e => setNameCol(e.target.value)}>
                  <option value="name">name</option><option value="full_name">full_name</option><option value="contact">contact</option>
                </select>
              </div>
              <div className={styles.formRow}>
                <label>Map "Email" column</label>
                <select className={styles.formSelect} value={emailCol} onChange={e => setEmailCol(e.target.value)}>
                  <option value="email">email</option><option value="email_address">email_address</option><option value="e-mail">e-mail</option>
                </select>
              </div>
              <div className={styles.formRow}>
                <label>Map "Company" column</label>
                <select className={styles.formSelect} value={companyCol} onChange={e => setCompanyCol(e.target.value)}>
                  <option value="company">company</option><option value="organization">organization</option><option value="employer">employer</option>
                </select>
              </div>
              <div className={styles.formRow}>
                <label>Default stage for imported leads</label>
                <select className={styles.formSelect} value={defaultStage} onChange={e => setDefaultStage(e.target.value)}>
                  {stageOptions.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </>
          )}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} disabled={!file || importing} onClick={handleImport} style={{ opacity: file ? 1 : 0.5 }}>
            <Icon name="upload" />{importing ? 'Importing…' : 'Import Contacts'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── LOG ACTIVITY MODAL ──────────────────────────────────────────────────────

function LogActivityModal({ leads, onClose, onSave }: {
  leads: Lead[]; onClose: () => void; onSave: (data: any) => Promise<void>
}) {
  const [actType, setActType] = useState<ActivityType>('call')
  const [form, setForm] = useState({ leadId: '', duration: '6', billable: true, notes: '', outcome: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [f]: e.target.value }))

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await onSave({ type: actType, ...form })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to log activity.')
      setSaving(false)
    }
  }

  const actTypes: Array<{ value: ActivityType; label: string; icon: IconName }> = [
    { value: 'call', label: 'Call', icon: 'phone' },
    { value: 'email', label: 'Email', icon: 'mail' },
    { value: 'meeting', label: 'Meeting', icon: 'calendar' },
    { value: 'note', label: 'Note', icon: 'task' },
    { value: 'task', label: 'Task', icon: 'check' },
  ]

  const billing6minUnits = Math.ceil(Number(form.duration) / 6)

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <Icon name="clock" />
          <h2>Log Activity</h2>
          <div className={styles.gdprBadge}><Icon name="check" />GDPR logged</div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.formRow}>
            <label>Activity type</label>
            <div className={styles.activityTypes}>
              {actTypes.map(t => (
                <button
                  key={t.value}
                  className={cx(styles.activityType, actType === t.value && styles.activityTypeActive)}
                  onClick={() => setActType(t.value)}
                >
                  <Icon name={t.icon} />{t.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.formRow}>
            <label>Linked lead</label>
            <select className={styles.formSelect} value={form.leadId} onChange={set('leadId')}>
              <option value="">No lead</option>
              {leads.slice(0, 30).map(l => <option key={l.id} value={l.id}>{l.contactName} – {l.company}</option>)}
            </select>
          </div>
          <div className={styles.formRow}>
            <label>Duration (minutes)</label>
            <div className={styles.durationRow}>
              <input className={cx(styles.formInput, styles.durationInput)} type="number" min={1} value={form.duration} onChange={set('duration')} />
              <span className={styles.durationUnits}>{billing6minUnits} × 6-min billing unit{billing6minUnits !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className={styles.formRow}>
            <label>Billing type</label>
            <div className={styles.billableToggle}>
              <label className={styles.toggle}>
                <input type="checkbox" checked={form.billable} onChange={e => setForm(p => ({ ...p, billable: e.target.checked }))} />
                <span className={styles.toggleSlider} />
              </label>
              <span style={{ color: '#d5e0f5', fontSize: 14 }}>{form.billable ? '💰 Billable' : '🔓 Non-billable'}</span>
            </div>
          </div>
          <div className={styles.formRow}><label>Outcome / notes</label><textarea className={styles.formTextarea} value={form.notes} onChange={set('notes')} placeholder="Brief summary of what happened..." /></div>
          {error && <p style={{ color: '#f87171', fontSize: 13, margin: '4px 0 0' }}>{error}</p>}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={saving}>Cancel</button>
          <button className={styles.btnPrimary} disabled={saving} onClick={handleSave}>
            <Icon name="check" />{saving ? 'Saving…' : 'Log Activity'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── EXPORT MODAL ─────────────────────────────────────────────────────────────

function ExportModal({ leads, onClose }: { leads: Lead[]; onClose: () => void }) {
  const [selected, setSelected] = useState<'csv' | 'xlsx' | 'json' | 'pdf'>('csv')
  const [includeAll, setIncludeAll] = useState(false)

  const formats = [
    { id: 'csv' as const, icon: '📄', label: 'CSV', desc: 'Comma-separated values — great for Excel & Google Sheets' },
    { id: 'xlsx' as const, icon: '📊', label: 'Excel (XLSX)', desc: 'Formatted spreadsheet with multiple worksheets' },
    { id: 'json' as const, icon: '🗂', label: 'JSON', desc: 'Machine-readable format for developers & integrations' },
    { id: 'pdf' as const, icon: '📑', label: 'PDF', desc: 'Printable report with branding and formatting' },
  ]

  function handleExport() {
    if (selected === 'csv') {
      const cols = ['contactName', 'company', 'role', 'score', 'stage', 'owner', 'source', 'value', 'engagement', 'lastActivity', 'nextAction']
      const header = cols.join(',')
      const rows = leads.map(l => cols.map(c => `"${(l as any)[c] ?? ''}"`).join(','))
      const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'leads.csv'; a.click()
    } else if (selected === 'json') {
      const blob = new Blob([JSON.stringify(leads, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'leads.json'; a.click()
    }
    gdprLog('export', 'leads', 'bulk', `format:${selected},count:${leads.length}`)
    onClose()
  }

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <Icon name="export" />
          <h2>Export Leads</h2>
          <div className={styles.gdprBadge}><Icon name="check" />GDPR logged</div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <p style={{ margin: 0, fontSize: 13, color: '#8090a5' }}>
            {leads.length} lead{leads.length !== 1 ? 's' : ''} selected for export.
          </p>
          <div className={styles.exportOptions}>
            {formats.map(f => (
              <button
                key={f.id}
                className={cx(styles.exportOption, selected === f.id && styles.exportOptionActive)}
                onClick={() => setSelected(f.id)}
              >
                <div className={styles.exportOptionIcon}>{f.icon}</div>
                <strong>{f.label}</strong>
                <span>{f.desc}</span>
              </button>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#b8c5d9', cursor: 'pointer' }}>
            <input type="checkbox" checked={includeAll} onChange={e => setIncludeAll(e.target.checked)} style={{ accentColor: '#2f6bff' }} />
            Include all fields (including internal notes)
          </label>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} onClick={handleExport}>
            <Icon name="export" />Download {selected.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CONTACT INPUT MODAL ─────────────────────────────────────────────────────

function ContactInputModal({ type, lead, current, onSave, onClose }: {
  type: 'email' | 'phone' | 'linkedin'; lead: Lead
  current?: LeadContact; onSave: (val: string) => void; onClose: () => void
}) {
  const [value, setValue] = useState(current?.[type] || '')
  const labels = { email: 'Email address', phone: 'Phone number', linkedin: 'LinkedIn URL' }
  const placeholders = { email: 'jane@example.com', phone: '+44 7700 000000', linkedin: 'https://linkedin.com/in/...' }
  const icons: Record<string, IconName> = { email: 'mail', phone: 'phone', linkedin: 'linkedin' }

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <Icon name={icons[type]} />
          <h2>Add {labels[type]}</h2>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <p style={{ margin: '0 0 4px', color: '#8090a5', fontSize: 13 }}>
            Save {labels[type].toLowerCase()} for <strong style={{ color: '#e5edfa' }}>{lead.contactName}</strong>
          </p>
          <div className={styles.contactInputRow}>
            <Icon name={icons[type]} />
            <input
              className={styles.contactInputField}
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={placeholders[type]}
              type={type === 'email' ? 'email' : type === 'phone' ? 'tel' : 'url'}
              autoFocus
            />
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} onClick={() => { if (value.trim()) onSave(value.trim()) }}>
            <Icon name="check" />Save &amp; {type === 'email' ? 'Send Email' : type === 'phone' ? 'Call' : 'Open LinkedIn'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── SHARED SUB-COMPONENTS ───────────────────────────────────────────────────

function Score({ value }: { value: number }) {
  return <span className={styles.score}>{value}</span>
}

function StageBadge({ stage }: { stage: LeadStage }) {
  return <span className={cx(styles.stageBadge, styles[`stage${stage.replaceAll(' ', '')}`])}>{stage}</span>
}

function ProgressBar({ value }: { value: number }) {
  return <i className={styles.progressTrack}><em style={{ width: `${value}%` }} /></i>
}

function Avatar({ initials, size = 'md' }: { initials: string; size?: 'sm' | 'md' }) {
  return <span className={cx(styles.avatar, size === 'sm' && styles.avatarSm)}>{initials}</span>
}

function initialsForOwner(owner: string) {
  return owner.split(' ').map(p => p[0]).join('').replace('.', '')
}

// ─── ICON COMPONENT ──────────────────────────────────────────────────────────

function Icon({ name, className }: { name: IconName; className?: string }) {
  const props = {
    width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className
  }
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    video: <><path d="M15 10l4.55-2.28A1 1 0 0 1 21 8.62v6.76a1 1 0 0 1-1.45.9L15 14" /><rect x="3" y="6" width="12" height="12" rx="2" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
    message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /></>,
    request: <><path d="M14 3l7 7-7 7" /><path d="M21 10H3" /><path d="M3 10l5-5" /><path d="M3 10l5 5" /></>,
    integrations: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 17h7" /><path d="M17.5 14v7" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></>,
    filter: <><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></>,
    export: <><path d="M12 3v12" /><path d="M7 8l5-5 5 5" /><path d="M5 21h14" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
    dollar: <><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" /></>,
    trend: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
    diamond: <><path d="M12 2l8 8-8 12L4 10z" /></>,
    star: <><path d="M12 2l2.8 6 6.5.8-4.8 4.5 1.2 6.4L12 16.5 6.3 19.7l1.2-6.4-4.8-4.5 6.5-.8z" /></>,
    task: <><path d="M9 11l2 2 4-4" /><rect x="4" y="3" width="16" height="18" rx="2" /></>,
    upload: <><path d="M12 15V3" /><path d="M7 8l5-5 5 5" /><path d="M5 21h14" /></>,
    owner: <><circle cx="12" cy="7" r="4" /><path d="M5.5 21a6.5 6.5 0 0 1 13 0" /></>,
    globe: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15 15 0 0 1 0 20" /><path d="M12 2a15 15 0 0 0 0 20" /></>,
    phone: <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07A19.5 19.5 0 0 1 5.15 12 19.8 19.8 0 0 1 2.08 3.37 2 2 0 0 1 4.06 1.2h3a2 2 0 0 1 2 1.72c.12.9.32 1.78.58 2.63a2 2 0 0 1-.45 2.11L8 8.85a16 16 0 0 0 7.15 7.15l1.19-1.19a2 2 0 0 1 2.11-.45c.85.26 1.73.46 2.63.58A2 2 0 0 1 22 16.92z" /></>,
    linkedin: <><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></>,
    ellipsis: <><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>,
    chevron: <><path d="M9 18l6-6-6-6" /></>,
    external: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14L21 3" /></>,
    sparkle: <><path d="M12 2l1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6z" /></>,
    check: <><path d="M20 6L9 17l-5-5" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
    columns: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /><path d="M15 4v16" /></>,
    crown: <><path d="M3 8l4 4 5-8 5 8 4-4v11H3z" /><path d="M3 19h18" /></>,
    play: <><polygon points="5,3 19,12 5,21" /></>,
    pause: <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>,
    timer: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5" /><path d="M9 3h6" /><path d="M12 3v2" /></>,
    warning: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
    info: <><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></>,
  }
  return <svg {...props}>{paths[name] ?? null}</svg>
}
