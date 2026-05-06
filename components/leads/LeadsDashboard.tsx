'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { DashboardSidebar } from './DashboardSidebar'
import styles from './LeadsDashboard.module.css'
import { Icon, Avatar, Score, StageBadge, ProgressBar, initialsForOwner } from './DashboardComponents'
import type { IconName, Lead, LeadStage, Metric, OwnerPerformance, PipelineStage, LeadSourcePerformance, TaskItem, Recommendation, ActivityItem, LeadContact } from './leads-types'
import { createLeadFromObject, logActivityEvent } from '@/lib/actions/lead-actions'
import { createTask, completeTask } from '@/lib/actions/task-actions'
import { logAuditEntry } from '@/lib/actions/audit-actions'
import { importContactsFromRows } from '@/lib/actions/import-actions'
import { openExternalSafely } from '@/lib/security/external-links'

// ─── TYPES ────────────────────────────────────────────────────────────────────

type PipelineSummary = {
  total: number; active: number; won: number; avgDeal: number
  totalFormatted: string; activeFormatted: string; wonFormatted: string; avgDealFormatted: string
}

interface LeadsDashboardProps {
  section?: DashboardSection
  initialLeads?: Lead[]
  metrics?: Metric[]
  ownerPerformance?: OwnerPerformance[]
  pipelineStages?: PipelineStage[]
  pipelineSummary?: PipelineSummary
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

const COLUMN_DEFS = [
  { id: 'company',      label: 'Company',       required: false },
  { id: 'score',        label: 'Score',         required: false },
  { id: 'stage',        label: 'Stage',         required: false },
  { id: 'owner',        label: 'Owner',         required: false },
  { id: 'source',       label: 'Source',        required: false },
  { id: 'lastActivity', label: 'Last activity', required: false },
  { id: 'engagement',   label: 'Engagement',    required: false },
  { id: 'value',        label: 'Value',         required: false },
  { id: 'nextAction',   label: 'Next action',   required: false },
] as const

type ColumnId = (typeof COLUMN_DEFS)[number]['id']
const ALL_COLS = new Set<ColumnId>(COLUMN_DEFS.map(c => c.id))
const COLS_KEY = 'o2d_lead_cols'

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
  pipelineSummary,
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
  const [sortBy, setSortBy] = useState<'lastActivity' | 'score' | 'value'>('lastActivity')
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
  const globalSearchRef = useRef<HTMLInputElement>(null)

  // Column visibility
  const [hiddenCols, setHiddenCols] = useState<Set<ColumnId>>(new Set())
  const [colsOpen, setColsOpen] = useState(false)

  useEffect(() => {
    try {
      const settings = JSON.parse(localStorage.getItem('o2d_accessibility_settings') || '{}')
      setThemeState(settings.theme || localStorage.getItem('crm_theme') || 'dark')
      setTextSizeState(settings.textSize === 'xl' ? 'lg' : settings.textSize || localStorage.getItem('crm_textsize') || 'md')
    } catch {
      setThemeState(localStorage.getItem('crm_theme') || 'dark')
      setTextSizeState(localStorage.getItem('crm_textsize') || 'md')
    }
    try {
      const saved = JSON.parse(localStorage.getItem(COLS_KEY) || '[]') as ColumnId[]
      if (saved.length) setHiddenCols(new Set(saved))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    function onHotkey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        globalSearchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onHotkey)
    return () => window.removeEventListener('keydown', onHotkey)
  }, [])

  function toggleColumn(id: ColumnId) {
    setHiddenCols(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      localStorage.setItem(COLS_KEY, JSON.stringify([...next]))
      return next
    })
  }

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
    const filtered = initialLeads.filter((lead) => {
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
    const toValue = (value: string) => Number(value.replace(/[^\d.-]/g, '')) || 0
    return [...filtered].sort((a, b) => {
      if (sortBy === 'score') return b.score - a.score
      if (sortBy === 'value') return toValue(b.value) - toValue(a.value)
      return toValue(b.lastActivity) - toValue(a.lastActivity)
    })
  }, [query, globalQuery, selectedStage, activeTab, filterStatus, filterOwner, filterSource, filterScoreMin, filterScoreMax, sortBy, initialLeads])

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

  function handleContactAction(type: 'email' | 'phone' | 'linkedin') {
    if (!selectedLead) return
    const contact = leadContacts[selectedLead.id]
    if (type === 'email') {
      const email = contact?.email
      if (!email) { setContactInputType('email'); setActiveModal('contactInput'); return }
      gdprLog('contact_attempt', 'lead_email', selectedLead.id)
      window.open(`mailto:${email}`, '_self')
    } else if (type === 'phone') {
      const phone = contact?.phone
      if (!phone) { setContactInputType('phone'); setActiveModal('contactInput'); return }
      gdprLog('contact_attempt', 'lead_phone', selectedLead.id)
      window.open(`tel:${phone}`, '_self')
    } else {
      const li = contact?.linkedin
      if (!li) { setContactInputType('linkedin'); setActiveModal('contactInput'); return }
      gdprLog('contact_attempt', 'lead_linkedin', selectedLead.id)
      openExternalSafely(li.startsWith('http') ? li : `https://linkedin.com/in/${li}`)
    }
  }

  return (
    <div className={styles.shell} data-theme={theme} data-size={textSize === 'md' ? undefined : textSize}>
      <DashboardSidebar active={section} />
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
                ref={globalSearchRef}
                value={globalQuery}
                onChange={e => setGlobalQuery(e.target.value)}
                placeholder="Search leads, contacts, companies..."
                aria-label="Search leads"
              />
              <span>⌘ K</span>
            </label>
            <button type="button" className={styles.utilityButton}>
              <Icon name="calendar" /> May 2025
            </button>
            <button
              type="button"
              className={cx(styles.utilityButton, activeFilterCount > 0 && styles.filterActive)}
              onClick={() => setActiveModal('filterPanel')}
            >
              <Icon name="filter" /> Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
            </button>
            <button type="button" className={styles.utilityButton} onClick={() => setActiveModal('export')}>
              <Icon name="export" /> Export
            </button>
            <div className={styles.createWrap}>
              <button type="button" className={styles.primaryButton} onClick={() => setIsCreateOpen((open) => !open)}>
                <Icon name="plus" /> Create / Add <Icon name="chevron" />
              </button>
              {isCreateOpen ? (
                <CreateMenu
                  onAddLead={() => { setActiveModal('addLead'); setIsCreateOpen(false) }}
                  onCreateTask={() => { setActiveModal('createTask'); setIsCreateOpen(false) }}
                  onUploadContacts={() => { setActiveModal('uploadContacts'); setIsCreateOpen(false) }}
                  onLogActivity={() => { setActiveModal('logActivity'); setIsCreateOpen(false) }}
                  onShowTimer={() => { setShowTimerWidget(true); setActiveModal(null); setIsCreateOpen(false) }}
                  onCreateVideo={() => { router.push('/dashboard/videos/editor'); setIsCreateOpen(false) }}
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
                  pipelineSummary={pipelineSummary}
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
                      type="button"
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
                      type="button"
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
                    <div className={styles.dropdownWrap}>
                      <button
                        className={cx(styles.filterButton, (colsOpen || hiddenCols.size > 0) && styles.filterActive)}
                        onClick={e => { e.stopPropagation(); setColsOpen(v => !v) }}
                      >
                        <Icon name="columns" /> Columns {hiddenCols.size > 0 ? `(${COLUMN_DEFS.length - hiddenCols.size}/${COLUMN_DEFS.length})` : ''}
                      </button>
                      {colsOpen && (
                        <ColumnsDropdown
                          hiddenCols={hiddenCols}
                          onToggle={toggleColumn}
                          onClose={() => setColsOpen(false)}
                        />
                      )}
                    </div>
                    <button type="button" className={styles.filterButton} onClick={() => {
                      setSortBy(current => current === 'lastActivity' ? 'score' : current === 'score' ? 'value' : 'lastActivity')
                    }}>
                      Sort: {sortBy === 'lastActivity' ? 'Last activity' : sortBy === 'score' ? 'Lead score' : 'Deal value'} <Icon name="chevron" />
                    </button>
                  </div>
                </div>

                {filteredLeads.length > 0 ? (
                  <LeadTable
                    leads={filteredLeads}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    totalCount={initialLeads.length}
                    onOpen={handleOpenLead}
                    hiddenCols={hiddenCols}
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
            pipelineSummary={pipelineSummary}
            onCompleteTask={async (id) => { await completeTask(id); router.refresh() }}
            onViewAllTasks={() => router.push('/dashboard/overview')}
            onViewAllActivity={() => router.push('/dashboard/messages')}
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
          onWebsite={() => {
            if (!selectedLead.website) return showNotice('Website unavailable', 'No website URL is stored for this lead yet.')
            openExternalSafely(selectedLead.website)
          }}
          onCreateVideo={() => router.push(`/dashboard/videos/editor?lead=${selectedLead.id}`)}
          onBookCall={() => router.push('/contact')}
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
          type="button"
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


// ─── CREATE MENU ─────────────────────────────────────────────────────────────

function CreateMenu({ onAddLead, onCreateTask, onUploadContacts, onLogActivity, onShowTimer, onCreateVideo }: {
  onAddLead: () => void; onCreateTask: () => void; onUploadContacts: () => void
  onLogActivity: () => void; onShowTimer: () => void; onCreateVideo: () => void
}) {
  const items = [
    { label: 'Add lead', icon: 'users' as IconName, action: onAddLead },
    { label: 'Import contacts', icon: 'upload' as IconName, action: onUploadContacts },
    { label: 'Create task', icon: 'task' as IconName, action: onCreateTask },
    { label: 'Log activity', icon: 'clock' as IconName, action: onLogActivity },
    { label: 'Start timer', icon: 'timer' as IconName, action: onShowTimer },
    { label: 'Create video', icon: 'video' as IconName, action: onCreateVideo },
  ]

  return (
    <div className={styles.createMenu} role="menu">
      {items.map((item) => (
        <button type="button" key={item.label} role="menuitem" onClick={item.action}>
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
        type="button"
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
  const isPositive = metric.delta.trim().startsWith('+')
  const hasDelta = metric.delta.trim() !== '+0%' && metric.delta.trim() !== '0%'
  return (
    <article className={styles.metricCard}>
      <div className={styles.metricTop}>
        <div className={styles.metricIcon}><Icon name={metric.icon} /></div>
        <span>{metric.label}</span>
      </div>
      <strong>{metric.value}</strong>
      <p>{hasDelta ? (isPositive ? '↑' : '↓') : '•'} {metric.delta}</p>
      <Sparkline values={metric.sparkline} />
    </article>
  )
}

// ─── SPARKLINE ───────────────────────────────────────────────────────────────

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) {
    return <div className={styles.sparkline} aria-hidden="true" />
  }
  if (values.length === 1) {
    const repeated = [values[0], values[0]]
    return <Sparkline values={repeated} />
  }
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

function AnalyticsStrip({ pipelineStages, pipelineSummary, sourcePerformance, ownerPerformance, totalLeadsCount }: {
  pipelineStages: PipelineStage[]; pipelineSummary?: PipelineSummary
  sourcePerformance: LeadSourcePerformance[]; ownerPerformance: OwnerPerformance[]; totalLeadsCount: number
}) {
  return (
    <section className={styles.analyticsGrid}>
      <article className={styles.analyticsCard}>
        <h3>Pipeline by stage</h3>
        {pipelineSummary && (
          <div className={styles.pipelineSummaryRow}>
            <div className={styles.pipelineStat}>
              <span>Total</span><strong>{pipelineSummary.totalFormatted}</strong>
            </div>
            <div className={styles.pipelineStat}>
              <span>Active</span><strong>{pipelineSummary.activeFormatted}</strong>
            </div>
            <div className={styles.pipelineStat}>
              <span>Won</span><strong>{pipelineSummary.wonFormatted}</strong>
            </div>
            <div className={styles.pipelineStat}>
              <span>Avg deal</span><strong>{pipelineSummary.avgDealFormatted}</strong>
            </div>
          </div>
        )}
        <div className={styles.funnelRow}>
          <Funnel pipelineStages={pipelineStages} />
          <div className={styles.stageLegend}>
            {pipelineStages.map(s => (
              <div key={s.label}>
                <i style={{ backgroundColor: s.color }} />
                <span>{s.label}</span>
                <strong>{s.count} · {s.valueFormatted}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.analyticsFooter}>
          {totalLeadsCount} leads · {pipelineSummary?.totalFormatted ?? '£0'} pipeline
        </div>
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
        <Link className={styles.panelLink} href="/dashboard/reports">View full report →</Link>
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
        <Link className={styles.panelLink} href="/dashboard/reports">View full leaderboard →</Link>
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
      <button type="button" className={selectedStage === 'All stages' ? styles.optionActive : ''} onClick={() => onSelect('All stages')}>
        <span>All stages</span><Icon name="check" />
      </button>
      {stageOptions.map(s => (
        <button type="button" key={s} className={selectedStage === s ? styles.optionActive : ''} onClick={() => onSelect(s)}>
          <span>{s}</span>{selectedStage === s ? <Icon name="check" /> : null}
        </button>
      ))}
    </div>
  )
}

// ─── COLUMNS DROPDOWN ────────────────────────────────────────────────────────

function ColumnsDropdown({ hiddenCols, onToggle, onClose }: {
  hiddenCols: Set<ColumnId>; onToggle: (id: ColumnId) => void; onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} className={styles.stageMenu} role="listbox" style={{ width: 200, right: 0, left: 'auto' }}>
      <div style={{ padding: '8px 12px 6px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.5 }}>
        Toggle columns
      </div>
      {COLUMN_DEFS.map(col => {
        const visible = !hiddenCols.has(col.id)
        return (
          <button type="button" key={col.id} onClick={() => onToggle(col.id)} className={visible ? styles.optionActive : ''}>
            <span>{col.label}</span>
            {visible ? <Icon name="check" /> : null}
          </button>
        )
      })}
    </div>
  )
}

// ─── LEAD TABLE ──────────────────────────────────────────────────────────────

function LeadTable({ leads, selectedId, onSelect, totalCount, onOpen, hiddenCols }: {
  leads: Lead[]; selectedId: string; onSelect: (id: string) => void
  totalCount: number; onOpen: (id: string) => void; hiddenCols: Set<ColumnId>
}) {
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const totalPages = Math.max(1, Math.ceil(leads.length / rowsPerPage))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * rowsPerPage
  const pageLeads = leads.slice(start, start + rowsPerPage)

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const show = (id: ColumnId) => !hiddenCols.has(id)
  return (
    <div className={styles.tableWrap}>
      <table className={styles.leadsTable}>
        <thead>
          <tr>
            <th><input aria-label="Select all" type="checkbox" /></th>
            <th>Lead</th>
            {show('company') && <th>Company</th>}
            {show('score') && <th>Score</th>}
            {show('stage') && <th>Stage</th>}
            {show('owner') && <th>Owner</th>}
            {show('source') && <th>Source</th>}
            {show('lastActivity') && <th>Last activity</th>}
            {show('engagement') && <th>Engagement</th>}
            {show('value') && <th>Value</th>}
            {show('nextAction') && <th>Next action</th>}
            <th />
          </tr>
        </thead>
        <tbody>
          {pageLeads.map(lead => (
            <tr
              key={lead.id}
              className={cx(selectedId === lead.id && styles.selectedRow)}
              onClick={() => onSelect(lead.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(lead.id)
                }
              }}
              tabIndex={0}
              aria-selected={selectedId === lead.id}
            >
              <td><input checked={selectedId === lead.id} readOnly type="checkbox" /></td>
              <td className={styles.leadCell}>
                <Avatar initials={lead.contactName.split(' ').map(n => n[0]).join('')} />
                <div><strong>{lead.contactName}</strong><span>{lead.role}</span></div>
              </td>
              {show('company') && (
                <td className={styles.companyCell}>
                  <div className={cx(styles.companyLogo, styles[lead.logoClass])}>{lead.companyMark}</div>
                  <span>{lead.company}</span>
                </td>
              )}
              {show('score') && <td><Score value={lead.score} /></td>}
              {show('stage') && <td><StageBadge stage={lead.stage} /></td>}
              {show('owner') && <td className={styles.ownerCell}><Avatar initials={initialsForOwner(lead.owner)} size="sm" />{lead.owner}</td>}
              {show('source') && <td><Icon name={lead.sourceIcon} className={styles.sourceIcon} /></td>}
              {show('lastActivity') && <td>{lead.lastActivity}</td>}
              {show('engagement') && (
                <td className={styles.engagementCell}><span>{lead.engagement}%</span><ProgressBar value={lead.engagement} /></td>
              )}
              {show('value') && <td><strong>{lead.value}</strong></td>}
              {show('nextAction') && (
                <td>
                <button type="button" style={{ background: 'none', border: 'none', color: '#3f8cff', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                    onClick={e => { e.stopPropagation(); onOpen(lead.id) }}>
                    {lead.nextAction}
                  </button>
                </td>
              )}
              <td>
                <button type="button" aria-label={`Open ${lead.contactName} details`} style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={e => { e.stopPropagation(); onOpen(lead.id) }}>
                  <Icon name="external" className={styles.rowMenu} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.tableFooter}>
        <span>Showing {leads.length === 0 ? 0 : start + 1}–{Math.min(start + rowsPerPage, leads.length)} of {totalCount} leads</span>
        <div className={styles.pagination}>
          <button type="button" aria-label="Previous page" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}>‹</button>
          <button className={styles.pageActive}>{safePage}</button>
          <span>of {totalPages}</span>
          <button type="button" aria-label="Next page" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>›</button>
        </div>
        <label className={styles.rowsButton}>
          Rows per page
          <select
            value={rowsPerPage}
            onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1) }}
            style={{ background: 'transparent', border: 'none', color: 'inherit', fontWeight: 700, marginLeft: 6 }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <Icon name="chevron" />
        </label>
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

function RightRail({ tasks, recommendations, recentActivity, section = 'leads', pipelineStages = [], pipelineSummary, onCompleteTask, onViewAllTasks, onViewAllActivity }: {
  tasks: TaskItem[]; recommendations: Recommendation[]; recentActivity: ActivityItem[]
  section?: DashboardSection
  pipelineStages?: PipelineStage[]
  pipelineSummary?: PipelineSummary
  onCompleteTask?: (id: string) => void
  onViewAllTasks?: () => void
  onViewAllActivity?: () => void
}) {
  return (
    <aside className={styles.rightRail}>
      {section === 'leads' && pipelineStages.length > 0 && (
        <article className={styles.analyticsCard}>
          <h3>Pipeline by stage</h3>
          {pipelineSummary && (
            <div className={styles.pipelineSummaryRow}>
              <div className={styles.pipelineStat}><span>Total</span><strong>{pipelineSummary.totalFormatted}</strong></div>
              <div className={styles.pipelineStat}><span>Active</span><strong>{pipelineSummary.activeFormatted}</strong></div>
            </div>
          )}
          <div className={styles.funnelRow}>
            <Funnel pipelineStages={pipelineStages} />
            <div className={styles.stageLegend}>
              {pipelineStages.map(s => (
                <div key={s.label}>
                  <i style={{ backgroundColor: s.color }} />
                  <span>{s.label}</span>
                  <strong>{s.count} · {s.valueFormatted}</strong>
                </div>
              ))}
            </div>
          </div>
          {pipelineSummary && (
            <div className={styles.analyticsFooter}>
              Avg deal <strong>{pipelineSummary.avgDealFormatted}</strong> · Won <strong>{pipelineSummary.wonFormatted}</strong>
            </div>
          )}
        </article>
      )}
      <Panel title="Today's priorities" badge={tasks.filter(t => !t.checked).length.toString()} action="All" onAction={onViewAllTasks}>
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
        <Link className={styles.panelLink} href="/dashboard/overview">View all tasks →</Link>
      </Panel>
      {section === 'leads' && (
        <Panel title="AI recommendations">
          <div className={styles.recommendationList}>
            {recommendations.map(item => (
              <div key={item.title} className={styles.recommendationItem}>
                <span className={cx(styles.recIcon, styles[`tone${item.tone}`])}><Icon name={item.icon} /></span>
                <div><strong>{item.title}</strong><p>{item.detail}</p></div>
          <button type="button">{item.action}</button>
              </div>
            ))}
          </div>
          <Link className={styles.panelLink} href="/dashboard/leads">View all →</Link>
        </Panel>
      )}
      {section === 'overview' && (
        <Panel title="Recent activity" action="All" onAction={onViewAllActivity}>
          <div className={styles.activityList}>
            {recentActivity.map(a => (
              <div key={a.title}><span /><p>{a.title}</p><time>{a.time}</time></div>
            ))}
          </div>
          <Link className={styles.panelLink} href="/dashboard/messages">View all activity →</Link>
        </Panel>
      )}
    </aside>
  )
}

function Panel({
  title,
  badge,
  action,
  onAction,
  children
}: {
  title: string
  badge?: string
  action?: string
  onAction?: () => void
  children: ReactNode
}) {
  return (
    <section className={styles.railPanel}>
      <header>
        <h3>{title}</h3>
        {badge ? <span className={styles.panelBadge}>{badge}</span> : null}
        {action ? <button type="button" onClick={onAction}>{action} <Icon name="chevron" /></button> : null}
      </header>
      {children}
    </section>
  )
}

// ─── COMMAND BAR ─────────────────────────────────────────────────────────────

function LeadCommandBar({ lead, onOpen, onEmail, onPhone, onLinkedin, onWebsite, onCreateVideo, onBookCall }: {
  lead: Lead; onOpen: (id: string) => void
  onEmail: () => void; onPhone: () => void; onLinkedin: () => void
  onWebsite: () => void; onCreateVideo: () => void; onBookCall: () => void
}) {
  return (
    <section className={styles.commandBar}>
      <div className={cx(styles.commandLogo, styles[lead.logoClass])}>{lead.companyMark}</div>
      <div className={styles.commandTitle}>
        <div><h2>{lead.company}</h2><StageBadge stage={lead.stage} /></div>
        <p>{lead.contactName} · {lead.role}</p>
        <div className={styles.contactActions}>
          <button type="button" title="Send email" aria-label="Send email" onClick={onEmail}><Icon name="mail" /></button>
          <button type="button" title="Call" aria-label="Call lead" onClick={onPhone}><Icon name="phone" /></button>
          <button type="button" title="LinkedIn" aria-label="Open LinkedIn" onClick={onLinkedin}><Icon name="linkedin" /></button>
          <button type="button" title="Website" aria-label="Open website" onClick={onWebsite}><Icon name="globe" /></button>
          <button type="button" aria-label="More actions"><Icon name="ellipsis" /></button>
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
        <button onClick={onCreateVideo}><Icon name="video" />Create video</button>
        <button onClick={onBookCall}><Icon name="calendar" />Book call</button>
        <button type="button" className={styles.iconButton} aria-label="More lead actions"><Icon name="ellipsis" /></button>
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
  const [importError, setImportError] = useState('')
  const [importReport, setImportReport] = useState<{
    totalRows: number
    imported: number
    failed: number
    failures: Array<{ rowNumber: number; reason: string; preview: string }>
  } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File) {
    setFile(f)
    setImportError('')
    setImportReport(null)
  }

  async function handleImport() {
    if (!file || importing) return
    setImporting(true)
    setImportError('')
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
      if (result.report) setImportReport(result.report)
      if (result.error) {
        setImportError(result.error)
        return
      }
      onImport(result.imported ?? 0)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Import failed. Please try again.')
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
                <button className={styles.btnSecondary} onClick={() => { setFile(null); setImportReport(null); setImportError('') }} style={{ padding: '4px 10px', minHeight: 28, fontSize: 12 }}>Remove</button>
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
              {importError ? (
                <div className={styles.licenseWarning}>
                  <span>{importError}</span>
                </div>
              ) : null}
              {importReport ? (
                <div className={styles.licenseCard} style={{ alignItems: 'flex-start' }}>
                  <div className={styles.licenseInfo}>
                    <strong>Import summary</strong>
                    <span>{importReport.imported} imported, {importReport.failed} skipped out of {importReport.totalRows} rows.</span>
                  </div>
                  {importReport.failures.length > 0 ? (
                    <div style={{ width: '100%', marginTop: 8 }}>
                      <div style={{ fontSize: 12, color: '#b8c5d9', marginBottom: 6 }}>Rows needing attention</div>
                      <div style={{ display: 'grid', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                        {importReport.failures.slice(0, 8).map((failure) => (
                          <div key={`${failure.rowNumber}-${failure.preview}`} style={{ fontSize: 12, color: '#d5e0f5', border: '1px solid rgba(120,145,182,0.28)', borderRadius: 8, padding: '8px 10px' }}>
                            <strong style={{ color: '#fca5a5' }}>Row {failure.rowNumber}</strong> - {failure.reason}
                            <div style={{ color: '#97a6bc', marginTop: 2 }}>{failure.preview}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
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
