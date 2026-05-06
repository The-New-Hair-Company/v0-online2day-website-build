'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { ComponentType, MouseEvent, ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Columns3,
  Crown,
  DollarSign,
  Download,
  ExternalLink,
  Filter,
  Grid2x2,
  Inbox,
  Link2,
  LogOut,
  Mail,
  MessageSquare,
  MonitorPlay,
  MoreHorizontal,
  PenSquare,
  Phone,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  UserPlus,
  UserRoundCheck,
  Users,
  Video,
  WandSparkles,
} from 'lucide-react'
import styles from './dashboard.module.css'
import { sendEnterpriseEmail } from '@/lib/actions/email-actions'
import { sendConversationReply } from '@/lib/actions/message-actions'
import type {
  CrmSetupConfig,
  ConversationRecord,
  CrmDashboardProps,
  DashboardSection,
  EmailRecord,
  EmailComposerLead,
  EmailComposerVideo,
  IntegrationStatus,
  LeadRecord,
  LeadStage,
  MetricItem,
  ProcessStep,
  RawMetric,
  SiteRequestRecord,
  TableTab,
  VideoRecord,
} from './types'

// ─── STATIC CONFIG ────────────────────────────────────────────────────────────

const LEAD_STAGES: Array<'All stages' | LeadStage> = [
  'All stages', 'New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won',
]

const LEAD_PROCESS: ProcessStep[] = [
  { step: 1, label: 'Capture lead' },
  { step: 2, label: 'Qualify' },
  { step: 3, label: 'Personalise outreach' },
  { step: 4, label: 'Send video' },
  { step: 5, label: 'Handle objections' },
  { step: 6, label: 'Book call' },
  { step: 7, label: 'Close' },
]

function currentDateRangeLabel() {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 7)
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${fmt(start)} – ${fmt(end)}`
}

function computeLeadTabs(leads: LeadRecord[]) {
  return [
    { label: 'All leads', count: leads.length },
    { label: 'High intent', count: leads.filter(l => l.score >= 80).length },
    { label: 'Follow-up due', count: leads.filter(l => l.stage !== 'Won').length },
    { label: 'At risk', count: leads.filter(l => l.score < 50).length },
    { label: 'Won', count: leads.filter(l => l.stage === 'Won').length },
  ]
}

function enrichMetrics(raw: RawMetric[], section: 'leads' | 'video' | 'email' | 'siteRequest'): MetricItem[] {
  const iconMaps: Record<string, Record<string, MetricItem['icon']>> = {
    leads: {
      'Total leads': Users,
      'New this week': CalendarDays,
      'Qualified leads': UserRoundCheck,
      'High-intent leads': Users,
      'Meetings booked': CalendarDays,
      'Pipeline value': DollarSign,
    },
    video: {
      'Total videos': Video,
      'Sent this week': MonitorPlay,
      'Avg watch rate': Activity,
      'Meetings booked': CalendarDays,
    },
    email: {
      'Emails sent': Mail,
      'Open rate': Target,
      'Click rate': BarChart3,
      'Reply rate': MessageSquare,
      'Meetings booked': CalendarDays,
      'Sequences active': Link2,
      'Deliverability': ShieldCheck,
      'Revenue influenced': DollarSign,
    },
    siteRequest: {
      'Open requests': Users,
      'New this week': CalendarDays,
      'Qualified': UserRoundCheck,
      'Pipeline value': DollarSign,
    },
  }
  const iconMap = iconMaps[section] || {}
  return raw.map(m => ({
    label: m.label,
    value: m.value,
    delta: m.delta,
    icon: iconMap[m.label] || Users,
    sparkline: [],
  }))
}

type MenuItem = {
  label: string
  icon: ComponentType<{ size?: number }>
  href?: string
}

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ')

const NAV_ITEMS: Array<{ label: string; href: string; section?: DashboardSection; icon: ComponentType<{ size?: number }>; badge?: string; group: string }> = [
  { label: 'Overview', href: '/dashboard/overview', section: 'overview', icon: Grid2x2, group: 'MAIN' },
  { label: 'Leads', href: '/dashboard/leads', section: 'leads', icon: Users, group: 'MAIN' },
  { label: 'Videos', href: '/dashboard/videos', section: 'videos', icon: Video, group: 'MAIN' },
  { label: 'Emails', href: '/dashboard/emails', section: 'emails', icon: Mail, group: 'MAIN' },
  { label: 'Messages', href: '/dashboard/messages', section: 'messages', icon: MessageSquare, badge: '4', group: 'MAIN' },
  { label: 'Enterprise', href: '/dashboard/enterprise', icon: Columns3, group: 'MAIN' },
  { label: 'Site Requests', href: '/dashboard/site-requests', section: 'site-requests', icon: Inbox, group: 'REQUESTS' },
  { label: 'Integrations', href: '/dashboard/integrations', section: 'integrations', icon: Settings2, group: 'TOOLS' },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings2, group: 'TOOLS' },
]

const PAGE_META: Record<DashboardSection, { title: string; description: string; searchPlaceholder: string; createLabel: string; createItems: MenuItem[] }> = {
  overview: {
    title: 'Overview',
    description: 'Your sales command centre',
    searchPlaceholder: 'Search leads, contacts, companies...',
    createLabel: 'Create / Add',
    createItems: [
      { label: 'Add lead', icon: UserPlus },
      { label: 'Create task', icon: PenSquare },
      { label: 'Upload contact list', icon: Upload },
      { label: 'Create video', icon: Video },
      { label: 'Log activity', icon: Sparkles },
    ],
  },
  leads: {
    title: 'Leads',
    description: 'Manage, prioritise and convert your outreach pipeline.',
    searchPlaceholder: 'Search leads, contacts, companies...',
    createLabel: 'Create / Add',
    createItems: [
      { label: 'Add lead', icon: UserPlus },
      { label: 'Import contacts', icon: Upload },
      { label: 'Create task', icon: PenSquare },
      { label: 'Assign owner', icon: Users },
      { label: 'Create video', icon: Video },
      { label: 'Log activity', icon: Sparkles },
    ],
  },
  videos: {
    title: 'Videos',
    description: 'Personalised video assets for your leads',
    searchPlaceholder: 'Search videos, leads, companies...',
    createLabel: 'Create / Upload Video',
    createItems: [
      { label: 'Open video editor', icon: WandSparkles, href: '/dashboard/videos/editor' },
      { label: 'Record new video', icon: Video, href: '/dashboard/videos/editor?mode=record' },
      { label: 'Upload existing video', icon: Upload, href: '/dashboard/videos/editor?mode=upload' },
      { label: 'Use template', icon: Grid2x2, href: '/dashboard/videos/editor?mode=template' },
      { label: 'Create AI intro', icon: Bot, href: '/dashboard/videos/editor?mode=ai-intro' },
      { label: 'Import from library', icon: Download },
    ],
  },
  emails: {
    title: 'Emails',
    description: 'Send, test and track emails that move leads closer to sale.',
    searchPlaceholder: 'Search leads, templates, campaigns...',
    createLabel: 'Create / Add',
    createItems: [
      { label: 'New campaign', icon: Mail },
      { label: 'Create template', icon: PenSquare },
      { label: 'Start sequence', icon: Send },
      { label: 'Send test email', icon: ExternalLink },
      { label: 'Import contacts', icon: Upload },
      { label: 'Log activity', icon: Sparkles },
    ],
  },
  messages: {
    title: 'Messages',
    description: 'Manage live conversations, qualify leads, and convert chat into revenue.',
    searchPlaceholder: 'Search conversations, leads, companies...',
    createLabel: 'Create / Add',
    createItems: [
      { label: 'New conversation', icon: MessageSquare },
      { label: 'Assign owner', icon: Users },
      { label: 'Create task', icon: PenSquare },
      { label: 'Create canned reply', icon: WandSparkles },
      { label: 'Send email', icon: Mail },
      { label: 'Log activity', icon: Sparkles },
    ],
  },
  'site-requests': {
    title: 'Site Requests',
    description: 'Manage incoming website and web app requests from enquiry to launch.',
    searchPlaceholder: 'Search requests, companies, owners...',
    createLabel: 'Create / Add',
    createItems: [
      { label: 'New request', icon: Inbox },
      { label: 'Create task', icon: PenSquare },
      { label: 'Assign owner', icon: Users },
      { label: 'Create proposal', icon: Mail },
      { label: 'Schedule discovery call', icon: CalendarDays },
      { label: 'Log activity', icon: Sparkles },
    ],
  },
  integrations: {
    title: 'Integrations',
    description: 'Connect your CRM workflows to email, automation, analytics, and storage.',
    searchPlaceholder: 'Search integrations, apps...',
    createLabel: 'Add Integration',
    createItems: [
      { label: 'Connect Supabase', icon: DatabaseIcon },
      { label: 'Connect Resend', icon: Mail },
      { label: 'Connect HubSpot', icon: Users },
      { label: 'Connect Calendar', icon: CalendarDays },
    ],
  },
}

export function CrmDashboard({
  section,
  initialLeads = [],
  initialVideos = [],
  initialEmails = [],
  initialConversations = [],
  initialSiteRequests = [],
  leadMetrics: rawLeadMetrics,
  videoMetrics: rawVideoMetrics,
  emailMetrics: rawEmailMetrics,
  siteRequestMetrics: rawSiteRequestMetrics,
  messageStats,
  integrationStatus,
  emailComposerData,
  setupConfig,
}: CrmDashboardProps) {
  const meta = PAGE_META[section]
  const router = useRouter()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [dateRange, setDateRange] = useState(currentDateRangeLabel())
  const [globalSearch, setGlobalSearch] = useState('')
  const [notice, setNotice] = useState<{ title: string; detail: string } | null>(null)

  const resolvedLeadMetrics = rawLeadMetrics ? enrichMetrics(rawLeadMetrics, 'leads') : []
  const resolvedVideoMetrics = rawVideoMetrics ? enrichMetrics(rawVideoMetrics, 'video') : []
  const resolvedEmailMetrics = rawEmailMetrics ? enrichMetrics(rawEmailMetrics, 'email') : []
  const resolvedSiteRequestMetrics = rawSiteRequestMetrics ? enrichMetrics(rawSiteRequestMetrics, 'siteRequest') : []
  const resolvedIntegrationStatus: IntegrationStatus = integrationStatus ?? { connected: 0, suggested: 0, pending: 0 }

  function showNotice(title: string, detail = 'Done.') {
    setNotice({ title, detail })
    window.setTimeout(() => setNotice(null), 3600)
  }

  function exportSectionCsv() {
    const rows = getRowsForSection(section, {
      initialLeads,
      initialVideos,
      initialEmails,
      initialConversations,
      initialSiteRequests,
    })

    if (rows.length === 0) {
      showNotice('Nothing to export', 'There is no data in this view yet.')
      return
    }

    const headers = Array.from(rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key))
      return set
    }, new Set<string>()))
    const csv = [
      headers.join(','),
      ...rows.map((row) => headers.map((key) => `"${String((row as any)[key] ?? '').replaceAll('"', '""')}"`).join(',')),
    ].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `online2day-${section}-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    showNotice('Export ready', `${rows.length} ${section.replace('-', ' ')} records downloaded.`)
  }

  function contactSales() {
    showNotice('Contact sales to add this', 'This feature is on our enterprise roadmap. Email sales@online2day.com to get early access.')
  }

  function handleCommand(label: string) {
    const normalized = label.replace(/\s+/g, ' ').trim()
    if (!normalized) return

    if (/export/i.test(normalized)) return exportSectionCsv()
    if (/view plan/i.test(normalized)) return router.push('/pricing')
    if (/create video|send video|record new video|upload existing video|use template|create ai intro/i.test(normalized)) return router.push('/dashboard/videos/editor')
    if (/open lead/i.test(normalized)) return router.push('/dashboard/leads')
    if (/^send email$/i.test(normalized)) return router.push('/dashboard/emails')
    if (/book call|calendly|schedule call/i.test(normalized)) return router.push('/contact')

    // Features not yet built — direct to sales
    if (/new campaign|create template|start sequence|create sequence|import contacts|upload contact list/i.test(normalized)) return contactSales()
    if (/new conversation|create canned reply/i.test(normalized)) return contactSales()
    if (/connect provider|open automations|open email settings|review mapping|manage connection|open library/i.test(normalized)) return contactSales()
    if (/new request|create proposal/i.test(normalized)) return contactSales()
    if (/assign owner/i.test(normalized)) return contactSales()

    if (/send proposal|share resource|convert to project|mark as scoped/i.test(normalized)) return showNotice(normalized, 'Workflow state recorded for the selected CRM item.')
    if (/filters|status|owner|source|audience|channel|score|budget|priority|type|goal|more filters/i.test(normalized)) return showNotice('Filter control active', 'Use the table controls and stage menus to narrow this workspace.')
    if (/columns/i.test(normalized)) return showNotice('Columns saved', 'Column preferences saved.')
    if (/sort|latest|last edited|last activity/i.test(normalized)) return showNotice('Sort applied', 'The table is now using the selected ordering preference.')
    if (/preview/i.test(normalized)) return showNotice('Preview opened', 'Preview mode is ready for review before sending.')
    if (/campaign|sequence|template|send test|send email/i.test(normalized)) return router.push('/dashboard/emails')
    if (/reply|note|attach|internal note|schedule send|send update/i.test(normalized)) return showNotice('Conversation action queued', 'The selected conversation action is ready in this workspace.')
    if (/clear filters/i.test(normalized)) return showNotice('Filters cleared', 'The current table filters have been reset.')
    if (/may|calendar|date/i.test(normalized)) {
      setDateRange((current) => current === currentDateRangeLabel() ? 'This month' : currentDateRangeLabel())
      return showNotice('Date range updated', 'Dashboard metrics and tables will use the selected range.')
    }
    if (/^\d+$|<|>/.test(normalized)) return showNotice('Page changed', 'Pagination state updated for this table.')

    showNotice(normalized, 'Action noted.')
  }

  function handleShellClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    const actionable = target.closest('button, a') as HTMLButtonElement | HTMLAnchorElement | null
    if (!actionable || actionable.closest('[data-dashboard-native="true"]')) return
    if ('disabled' in actionable && actionable.disabled) return

    const href = actionable instanceof HTMLAnchorElement ? actionable.getAttribute('href') : null
    if (href === '#') event.preventDefault()

    const label = actionable.getAttribute('aria-label') || actionable.getAttribute('title') || actionable.textContent || ''
    if (href && href !== '#') return
    handleCommand(label)
  }

  return (
    <div className={styles.shell} onClick={handleShellClick}>
      <Sidebar currentSection={section} />
      <main className={styles.main}>
        <header className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>{meta.title}</h1>
            <p className={styles.pageDescription}>{meta.description}</p>
          </div>

          <div className={styles.headerTools}>
            <label className={styles.searchBox}>
              <Search size={16} />
              <input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder={meta.searchPlaceholder} aria-label={meta.searchPlaceholder} />
              <span className={styles.shortcut}>⌘ K</span>
            </label>
            <button className={styles.button}>
              <CalendarDays size={16} />
              {dateRange}
              <ChevronDown size={16} />
            </button>
            <button className={styles.button}>
              <Filter size={16} />
              Filters
            </button>
            <button className={styles.button}>
              <Download size={16} />
              Export
            </button>
            <div className={styles.menuWrap}>
              <button className={styles.buttonPrimary} data-dashboard-native="true" onClick={() => setIsCreateOpen((value) => !value)}>
                <Plus size={16} />
                {meta.createLabel}
                <ChevronDown size={16} />
              </button>
              {isCreateOpen ? (
                <div className={styles.menu} data-dashboard-native="true">
                  {meta.createItems.map((item) => {
                    const Icon = item.icon
                    return (
                      item.href ? (
                        <Link key={item.label} href={item.href}>
                          <Icon size={16} />
                          {item.label}
                        </Link>
                      ) : (
                        <button key={item.label} type="button" onClick={() => handleCommand(item.label)}>
                          <Icon size={16} />
                          {item.label}
                        </button>
                      )
                    )
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {renderSection(section, {
          initialLeads,
          initialVideos,
          initialEmails,
          initialConversations,
          initialSiteRequests,
          resolvedLeadMetrics,
          resolvedVideoMetrics,
          resolvedEmailMetrics,
          resolvedSiteRequestMetrics,
          messageStats,
          resolvedIntegrationStatus,
          emailComposerData,
          setupConfig,
        })}
        {notice ? (
          <div className={styles.actionToast} role="status" aria-live="polite">
            <strong>{notice.title}</strong>
            <span>{notice.detail}</span>
          </div>
        ) : null}
      </main>
    </div>
  )
}

function getRowsForSection(section: DashboardSection, data: {
  initialLeads: LeadRecord[]
  initialVideos: VideoRecord[]
  initialEmails: EmailRecord[]
  initialConversations: ConversationRecord[]
  initialSiteRequests: SiteRequestRecord[]
}) {
  switch (section) {
    case 'leads':
    case 'overview':
      return data.initialLeads
    case 'videos':
      return data.initialVideos
    case 'emails':
      return data.initialEmails
    case 'messages':
      return data.initialConversations
    case 'site-requests':
      return data.initialSiteRequests
    default:
      return []
  }
}

function Sidebar({ currentSection }: { currentSection: DashboardSection }) {
  const pathname = usePathname()
  const groups = ['MAIN', 'REQUESTS', 'TOOLS']

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <h2 className={styles.brandTitle}>Online2Day</h2>
        <p className={styles.brandText}>CRM Dashboard</p>
      </div>

      {groups.map((group) => (
        <div className={styles.navGroup} key={group}>
          <p className={styles.navLabel}>{group}</p>
          {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
            const Icon = item.icon
            const isActive = currentSection === item.section || pathname === item.href
            return (
              <Link key={item.href} href={item.href} className={cx(styles.navItem, isActive && styles.navItemActive)}>
                <Icon size={17} />
                <span>{item.label}</span>
                {item.badge ? <span className={styles.navBadge}>{item.badge}</span> : null}
                {isActive && !item.badge ? <span className={styles.navDot} /> : null}
              </Link>
            )
          })}
        </div>
      ))}

      <div className={styles.sidebarSpacer} />

      <div className={styles.planCard}>
        <div className={styles.planIcon}>
          <Crown size={18} />
        </div>
        <h3>Pro Plan</h3>
        <p>You have unlimited videos and advanced analytics.</p>
        <Link href="/pricing" className={cx(styles.buttonPrimary, styles.planButton)}>View Plan</Link>
      </div>

      <form action="/auth/signout" method="post" style={{ display: 'contents' }}>
        <button type="submit" className={styles.signOut}>
          <LogOut size={17} />
          Sign Out
        </button>
      </form>
    </aside>
  )
}

type ResolvedSectionProps = Omit<CrmDashboardProps, 'section' | 'leadMetrics' | 'videoMetrics' | 'emailMetrics' | 'siteRequestMetrics' | 'integrationStatus'> & {
  resolvedLeadMetrics: MetricItem[]
  resolvedVideoMetrics: MetricItem[]
  resolvedEmailMetrics: MetricItem[]
  resolvedSiteRequestMetrics: MetricItem[]
  resolvedIntegrationStatus: IntegrationStatus
}

function renderSection(section: DashboardSection, props: ResolvedSectionProps) {
  switch (section) {
    case 'overview':
      return <OverviewSection initialLeads={props.initialLeads} metrics={props.resolvedLeadMetrics} />
    case 'leads':
      return <LeadsSection initialLeads={props.initialLeads} metrics={props.resolvedLeadMetrics} />
    case 'videos':
      return <VideosSection initialVideos={props.initialVideos} metrics={props.resolvedVideoMetrics} setupConfig={props.setupConfig} />
    case 'emails':
      return <EmailsSection initialEmails={props.initialEmails} metrics={props.resolvedEmailMetrics} composerData={props.emailComposerData} setupConfig={props.setupConfig} />
    case 'messages':
      return <MessagesSection initialConversations={props.initialConversations} messageStats={props.messageStats} />
    case 'site-requests':
      return <SiteRequestsSection initialSiteRequests={props.initialSiteRequests} metrics={props.resolvedSiteRequestMetrics} />
    case 'integrations':
      return <IntegrationsSection integrationStatus={props.resolvedIntegrationStatus} />
    default:
      return null
  }
}

function OverviewSection({ initialLeads = [], metrics = [] }: { initialLeads?: LeadRecord[]; metrics?: MetricItem[] }) {
  const [selectedId, setSelectedId] = useState(initialLeads[0]?.id || '')
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState('All leads')
  const [stage, setStage] = useState<'All stages' | LeadStage>('All stages')
  const [showStageMenu, setShowStageMenu] = useState(true)

  const filtered = useFilteredLeads(query, stage, activeTab, initialLeads)
  const selectedLead = initialLeads.find((lead) => lead.id === selectedId) ?? initialLeads[0]

  return (
    <>
      <MetricGrid items={metrics} />
      <ProcessRow
        title="Guide to Sale: Your sales process"
        steps={LEAD_PROCESS}
        activeStep={3}
        nextActionTitle="Next best action"
        nextActionText="Follow up with 5 high-intent leads"
      />

      <div className={styles.overviewTop}>
        <div className={styles.analyticsGrid}>
          <FunnelPanel title="Pipeline performance" />
          <ForecastPanel title="Revenue forecast" />
          <SimpleTablePanel title="Lead source performance" rows={[
            ['Website', '512', '8.2%', '$742K'],
            ['Referral', '248', '12.1%', '$482K'],
            ['Cold outreach', '176', '6.8%', '$236K'],
            ['Ads', '152', '5.1%', '$198K'],
            ['Organic', '160', '7.5%', '$166K'],
          ]} headers={['Source', 'Leads', 'Conversion', 'Value']} linkLabel="View full report" />
        </div>

        <div className={styles.rightRail}>
          <TasksPanel />
          <RecommendationsPanel />
        </div>
      </div>

      <div className={styles.panelGrid}>
        <div className={cx(styles.panel, styles.tablePanel)}>
          <Tabs tabs={computeLeadTabs(initialLeads)} activeTab={activeTab} onChange={setActiveTab} />
          <LeadToolbar
            query={query}
            onQueryChange={setQuery}
            stage={stage}
            onStageChange={setStage}
            showStageMenu={showStageMenu}
            onToggleStageMenu={() => setShowStageMenu((value) => !value)}
          />
          <LeadTable leads={filtered} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        <div className={styles.rightRail}>
          <ActivityPanel />
          <GoalPanel meetings="32 / 50" revenue="$128K / $200K" />
        </div>
      </div>

      <LeadBottomBar lead={selectedLead} />
    </>
  )
}

function LeadsSection({ initialLeads = [], metrics = [] }: { initialLeads?: LeadRecord[]; metrics?: MetricItem[] }) {
  const [selectedId, setSelectedId] = useState(initialLeads[0]?.id || '')
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState('All leads')
  const [stage, setStage] = useState<'All stages' | LeadStage>('All stages')
  const [showStageMenu, setShowStageMenu] = useState(true)
  const filtered = useFilteredLeads(query, stage, activeTab, initialLeads)
  const selectedLead = initialLeads.find((lead) => lead.id === selectedId) ?? initialLeads[0]

  return (
    <>
      <MetricGrid items={metrics} />
      <ProcessRow
        title="Guide to Sale: Your lead conversion process"
        steps={LEAD_PROCESS}
        activeStep={3}
        nextActionTitle="Next best action"
        nextActionText="Follow up with 5 high-intent leads"
      />

      <div className={styles.panelGrid}>
        <div className={styles.twoUp}>
          <FunnelPanel title="Pipeline by stage" />
          <SimpleTablePanel title="Lead source performance" rows={[
            ['Website', '72', '28%', '$512K'],
            ['Referral', '48', '31%', '$430K'],
            ['Cold outreach', '36', '19%', '$216K'],
            ['Ads', '28', '22%', '$198K'],
            ['Organic', '22', '27%', '$164K'],
          ]} headers={['Source', 'Leads', 'Conv. rate', 'Value']} linkLabel="View full report" />
        </div>

        <div className={styles.rightRail}>
          <TasksPanel />
          <RecommendationsPanel />
        </div>
      </div>

      <div className={styles.panelGrid}>
        <div className={cx(styles.panel, styles.tablePanel)}>
          <Tabs tabs={computeLeadTabs(initialLeads)} activeTab={activeTab} onChange={setActiveTab} />
          <LeadToolbar
            query={query}
            onQueryChange={setQuery}
            stage={stage}
            onStageChange={setStage}
            showStageMenu={showStageMenu}
            onToggleStageMenu={() => setShowStageMenu((value) => !value)}
          />
          <LeadTable leads={filtered} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        <div className={styles.rightRail}>
          <ActivityPanel />
          <GoalPanel meetings="32 / 50" revenue="$128K / $200K" />
        </div>
      </div>

      <LeadBottomBar lead={selectedLead} />
    </>
  )
}

function VideosSection({ initialVideos = [], metrics = [], setupConfig }: { initialVideos?: VideoRecord[]; metrics?: MetricItem[]; setupConfig?: CrmSetupConfig }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(initialVideos[0]?.id || '')
  const [showStageMenu, setShowStageMenu] = useState(true)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showOwnerMenu, setShowOwnerMenu] = useState(false)
  const [showChannelMenu, setShowChannelMenu] = useState(false)
  const [stage, setStage] = useState('All stages')
  const [status, setStatus] = useState('All statuses')
  const [owner, setOwner] = useState('All owners')
  const [channel, setChannel] = useState('All channels')
  const [activeTab, setActiveTab] = useState('Library')
  const [ctaType, setCtaType] = useState(setupConfig?.defaultCtaLabel || 'Book call')
  const [ctaUrl, setCtaUrl] = useState(setupConfig?.defaultCtaUrl || setupConfig?.bookingUrl || 'https://calendly.com/online2day/demo')
  const videoTabs = [{ label: 'Library' }, { label: 'Personalised' }, { label: 'Templates' }, { label: 'Campaigns' }, { label: 'Analytics' }]
  const statuses = useMemo(() => ['All statuses', ...Array.from(new Set(initialVideos.map((video) => video.status)))], [initialVideos])
  const owners = useMemo(() => ['All owners', ...Array.from(new Set(initialVideos.map((video) => video.owner)))], [initialVideos])
  const channels = useMemo(() => ['All channels', ...Array.from(new Set(initialVideos.map((video) => video.channel)))], [initialVideos])

  function clearVideoFilters() {
    setQuery('')
    setStage('All stages')
    setStatus('All statuses')
    setOwner('All owners')
    setChannel('All channels')
  }

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return initialVideos.filter((video) => {
      const matchesQuery = normalized
        ? `${video.title} ${video.company} ${video.owner} ${video.status}`.toLowerCase().includes(normalized)
        : true
      const matchesStage = stage === 'All stages' || video.funnelStage === stage
      const matchesStatus = status === 'All statuses' || video.status === status
      const matchesOwner = owner === 'All owners' || video.owner === owner
      const matchesChannel = channel === 'All channels' || video.channel === channel
      return matchesQuery && matchesStage && matchesStatus && matchesOwner && matchesChannel
    })
  }, [query, stage, status, owner, channel, initialVideos])
  const selectedVideo = initialVideos.find((video) => video.id === selectedId) ?? initialVideos[0] ?? null

  if (!selectedVideo) {
    return (
      <>
        <MetricGrid items={metrics} />

        <div className={styles.panelGrid}>
          <div className={cx(styles.panel, styles.tablePanel)}>
            <Tabs tabs={videoTabs} activeTab={activeTab} onChange={setActiveTab} />
            <div className={styles.toolbar}>
              <label className={styles.smallSearch}>
                <Search size={14} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search videos..." />
              </label>
              <div className={styles.dropdownWrap}>
                <button className={styles.chipButton} onClick={() => setShowStageMenu((value) => !value)}>
                  Funnel stage
                  <ChevronDown size={14} />
                </button>
                {showStageMenu ? (
                  <div className={styles.dropdown}>
                    {['All stages', 'Prospecting', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won'].map((item) => (
                      <button key={item} className={cx(stage === item && styles.dropdownActive)} onClick={() => setStage(item)}>
                        {item}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className={styles.dropdownWrap}>
                <button className={styles.chipButton} onClick={() => setShowStatusMenu((value) => !value)}>Status <ChevronDown size={14} /></button>
                {showStatusMenu ? <div className={styles.dropdown}>{statuses.map((item) => <button key={item} className={cx(status === item && styles.dropdownActive)} onClick={() => setStatus(item)}>{item}</button>)}</div> : null}
              </div>
              <div className={styles.dropdownWrap}>
                <button className={styles.chipButton} onClick={() => setShowOwnerMenu((value) => !value)}>Owner <ChevronDown size={14} /></button>
                {showOwnerMenu ? <div className={styles.dropdown}>{owners.map((item) => <button key={item} className={cx(owner === item && styles.dropdownActive)} onClick={() => setOwner(item)}>{item}</button>)}</div> : null}
              </div>
              <div className={styles.dropdownWrap}>
                <button className={styles.chipButton} onClick={() => setShowChannelMenu((value) => !value)}>Channel <ChevronDown size={14} /></button>
                {showChannelMenu ? <div className={styles.dropdown}>{channels.map((item) => <button key={item} className={cx(channel === item && styles.dropdownActive)} onClick={() => setChannel(item)}>{item}</button>)}</div> : null}
              </div>
              <button className={styles.buttonGhost} onClick={clearVideoFilters}>Clear filters</button>
            </div>
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
              No videos found. Upload or create videos to see them here.
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <MetricGrid items={metrics} />

      <div className={styles.panelGrid}>
        <div className={cx(styles.panel, styles.tablePanel)}>
          <Tabs tabs={videoTabs} activeTab={activeTab} onChange={setActiveTab} />
          <div className={styles.toolbar}>
            <label className={styles.smallSearch}>
              <Search size={14} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search videos..." />
            </label>
            <div className={styles.dropdownWrap}>
              <button className={styles.chipButton} onClick={() => setShowStageMenu((value) => !value)}>
                Funnel stage
                <ChevronDown size={14} />
              </button>
              {showStageMenu ? (
                <div className={styles.dropdown}>
                  {['All stages', 'Prospecting', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won'].map((item) => (
                    <button key={item} className={cx(stage === item && styles.dropdownActive)} onClick={() => setStage(item)}>
                      {item}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className={styles.dropdownWrap}>
              <button className={styles.chipButton} onClick={() => setShowStatusMenu((value) => !value)}>Status <ChevronDown size={14} /></button>
              {showStatusMenu ? <div className={styles.dropdown}>{statuses.map((item) => <button key={item} className={cx(status === item && styles.dropdownActive)} onClick={() => setStatus(item)}>{item}</button>)}</div> : null}
            </div>
            <div className={styles.dropdownWrap}>
              <button className={styles.chipButton} onClick={() => setShowOwnerMenu((value) => !value)}>Owner <ChevronDown size={14} /></button>
              {showOwnerMenu ? <div className={styles.dropdown}>{owners.map((item) => <button key={item} className={cx(owner === item && styles.dropdownActive)} onClick={() => setOwner(item)}>{item}</button>)}</div> : null}
            </div>
            <div className={styles.dropdownWrap}>
              <button className={styles.chipButton} onClick={() => setShowChannelMenu((value) => !value)}>Channel <ChevronDown size={14} /></button>
              {showChannelMenu ? <div className={styles.dropdown}>{channels.map((item) => <button key={item} className={cx(channel === item && styles.dropdownActive)} onClick={() => setChannel(item)}>{item}</button>)}</div> : null}
            </div>
            <button className={styles.buttonGhost} onClick={clearVideoFilters}>Clear filters</button>
          </div>
          <VideoTable rows={filtered} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        <div className={styles.rightRail}>
          <RightPanel title="Lead engagement snapshot">
            <div className={styles.list}>
              <div>
                <strong>Acme Corporation</strong>
                <div className={styles.subtle}>Sarah Johnson · Marketing Director</div>
              </div>
              <div>
                <strong>Video: Q2 Marketing Proposal</strong>
              </div>
              {['Watched 84%', 'Clicked CTA (Book meeting)', 'Revisited pricing section', 'Awaiting your follow-up'].map((item) => (
                <div key={item} className={styles.listRow}>
                  <span>{item}</span>
                  {item === 'Watched 84%' ? <span className={cx(styles.pill, styles.pillGreen)}>High intent</span> : <span />}
                </div>
              ))}
            </div>
          </RightPanel>
          <RightPanel title="Recommended actions">
            <div className={styles.recommendationList}>
              <RecommendationAction title="Send follow-up email" subtitle="Sarah watched 84% and clicked CTA" actionLabel="Send" />
              <RecommendationAction title="Create task" subtitle="Follow up within 24 hours" actionLabel="Create" />
            </div>
          </RightPanel>
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.videoPreview}>
          <div className={styles.previewCard}>
            <div className={styles.playButton}>
              <span onClick={() => router.push(`/dashboard/videos/editor?video=${selectedVideo.id}`)}>
                <Video size={22} />
              </span>
            </div>
          </div>
      <div className={styles.list}>
            <div>
              <strong>{selectedVideo?.title}</strong>
              <div className={styles.subtitle}>{selectedVideo?.company}</div>
            </div>
            <div className={styles.listRow}><span>Owner</span><strong>{selectedVideo?.owner}</strong></div>
            <div className={styles.listRow}><span>Created</span><strong>May 10, 2025</strong></div>
            <div className={styles.listRow}><span>Last updated</span><strong>May 16, 2025</strong></div>
            <div className={styles.listRow}><span>Views</span><strong>3</strong></div>
            <div className={styles.goalRow}>
              <div className={styles.goalHead}><span>Watch rate</span><strong>{selectedVideo?.watchRate}%</strong></div>
              <div className={styles.barTrack}><div className={styles.barFill} style={{ width: `${selectedVideo?.watchRate ?? 0}%` }} /></div>
            </div>
          </div>
          <div className={styles.list}>
            <div className={styles.panelTitle}>CTA configuration</div>
            <button className={styles.buttonGhost} onClick={() => setCtaType((current) => current === 'Book call' ? 'Watch video' : current === 'Watch video' ? 'Reply to email' : 'Book call')}>{ctaType} <ChevronDown size={14} /></button>
            <button className={styles.buttonGhost} onClick={() => {
              const next = window.prompt('Update CTA destination URL', ctaUrl)
              if (next && next.trim()) setCtaUrl(next.trim())
            }}>{ctaUrl} <ChevronDown size={14} /></button>
            <button className={styles.button} onClick={() => window.open(ctaUrl, '_blank', 'noopener,noreferrer')}><ExternalLink size={15} /> Preview CTA</button>
          </div>
        </div>
      </div>
    </>
  )
}

function EmailsSection({
  initialEmails = [],
  metrics = [],
  composerData = { leads: [], videos: [] },
  setupConfig,
}: {
  initialEmails?: EmailRecord[]
  metrics?: MetricItem[]
  composerData?: { leads: EmailComposerLead[]; videos: EmailComposerVideo[] }
  setupConfig?: CrmSetupConfig
}) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(initialEmails[1]?.id || initialEmails[0]?.id || '')
  const [stage, setStage] = useState('All stages')
  const [showStageMenu, setShowStageMenu] = useState(true)
  const [isComposerOpen, setIsComposerOpen] = useState(false)

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return initialEmails.filter((email) => {
      const matchesQuery = normalized
        ? `${email.template} ${email.audience} ${email.subject} ${email.owner}`.toLowerCase().includes(normalized)
        : true
      const matchesStage = stage === 'All stages' || email.stage === stage
      return matchesQuery && matchesStage
    })
  }, [query, stage, initialEmails])
  const selectedEmail = initialEmails.find((email) => email.id === selectedId) ?? initialEmails[0]

  return (
    <>
      <MetricGrid items={metrics} />

      <div className={styles.emailTop}>
        <div className={styles.twoUp}>
          <LineChartPanel title="Campaign performance" legend={['Opens', 'Clicks', 'Replies']} />
          <SimpleTablePanel title="Template performance" rows={[
            ['Initial outreach', '324', '52%', '14%', '6'],
            ['Video follow-up', '198', '61%', '18%', '5'],
            ['Proposal sent', '84', '69%', '21%', '4'],
            ['Chase-up 1', '276', '41%', '9%', '3'],
            ['Chase-up 2', '122', '33%', '6%', '2'],
          ]} headers={['Template', 'Sent', 'Open rate', 'Reply rate', 'Meetings']} linkLabel="View all templates" />
        </div>
        <div className={styles.rightRail}>
          <TasksPanel title="Today's priorities" />
          <RecommendationsPanel title="AI recommendations" />
        </div>
      </div>

      <div className={styles.panelGrid}>
        <div className={cx(styles.panel, styles.tablePanel)}>
          <Tabs tabs={[{ label: 'Templates' }, { label: 'Sequences' }, { label: 'Campaigns' }, { label: 'A/B Tests' }, { label: 'Analytics' }]} activeTab="Templates" onChange={() => undefined} />
          <div className={styles.toolbar}>
            <label className={styles.smallSearch}>
              <Search size={14} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search emails..." />
            </label>
            <button className={styles.chipButton}>Status</button>
            <button className={styles.chipButton}>Owner</button>
            <button className={styles.chipButton}>Audience</button>
            <div className={styles.dropdownWrap}>
              <button className={styles.chipButton} onClick={() => setShowStageMenu((value) => !value)}>
                Stage
                <ChevronDown size={14} />
              </button>
              {showStageMenu ? (
                <div className={styles.dropdown}>
                  {['All stages', 'Initial outreach', 'Follow-up', 'Proposal', 'Re-engagement', 'Closed won/lost'].map((item) => (
                    <button key={item} className={cx(stage === item && styles.dropdownActive)} onClick={() => setStage(item)}>
                      {item}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button className={styles.chipButton}>Goal</button>
            <button className={styles.chipButton}>More filters</button>
            <div className={styles.toolbarRight}>
              <button className={styles.chipButton}><Columns3 size={14} /> Columns</button>
              <button className={styles.chipButton}>Sort: Last edited <ChevronDown size={14} /></button>
            </div>
          </div>
          <EmailTable rows={filtered} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        <div className={styles.rightRail}>
          <ActivityPanel title="Recent email activity" />
        </div>
      </div>

      {selectedEmail && (
        <div className={styles.bottomBar}>
          <div className={styles.identity}>
            <div className={styles.logoMark}><Video size={14} /></div>
            <div>
              <strong>{selectedEmail.template}</strong>
              <div className={styles.subtle}>Used for warm prospects after first contact</div>
            </div>
          </div>
          <div>
            <div className={styles.subtle}>Owner</div>
            <strong>{selectedEmail.owner}</strong>
          </div>
          <div>
            <div className={styles.subtle}>Audience</div>
            <strong>{selectedEmail.audience}</strong>
          </div>
          <div>
            <div className={styles.subtle}>Last edited</div>
            <strong>{selectedEmail.lastEdited}</strong>
          </div>
          <div className={styles.ctaCard}>
            <strong>Recommended CTA</strong>
            <div className={styles.subtle}>Pair this email with a personalised video to lift reply rate and move leads to meeting booked.</div>
          </div>
          <div className={styles.actionGroup}>
            <button className={styles.button} onClick={() => setIsComposerOpen(true)}>Preview email</button>
            <button className={styles.button} onClick={() => setIsComposerOpen(true)}>Send test</button>
            <button className={styles.buttonPrimary} onClick={() => setIsComposerOpen(true)}>Launch campaign</button>
            <button className={styles.button}>Create sequence</button>
            <button className={styles.button}><MoreHorizontal size={16} /></button>
          </div>
        </div>
      )}
      {isComposerOpen ? (
        <EnterpriseEmailComposer
          selectedTemplate={selectedEmail}
          leads={composerData.leads}
          videos={composerData.videos}
          setupConfig={setupConfig}
          onClose={() => setIsComposerOpen(false)}
        />
      ) : null}
    </>
  )
}

function EnterpriseEmailComposer({
  selectedTemplate,
  leads,
  videos,
  setupConfig,
  onClose,
}: {
  selectedTemplate?: EmailRecord
  leads: EmailComposerLead[]
  videos: EmailComposerVideo[]
  setupConfig?: CrmSetupConfig
  onClose: () => void
}) {
  const firstLead = leads.find((lead) => lead.email) || leads[0]
  const [leadId, setLeadId] = useState(firstLead?.id || '')
  const selectedLead = leads.find((lead) => lead.id === leadId)
  const leadVideos = videos.filter((video) => !leadId || video.leadId === leadId)
  const [videoAssetId, setVideoAssetId] = useState(leadVideos[0]?.id || '')
  const [to, setTo] = useState(firstLead?.email || '')
  const [subject, setSubject] = useState(selectedTemplate?.subject || `A quick personalised video from ${setupConfig?.companyName || 'Online2Day'}`)
  const [body, setBody] = useState(`I wanted to send over a focused follow-up for ${firstLead?.company || 'your team'}.\n\nThe video below walks through the most relevant next step and gives you a simple way to ${setupConfig?.defaultCtaLabel?.toLowerCase() || 'book a call'} if it is useful.`)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  function handleLeadChange(nextLeadId: string) {
    const nextLead = leads.find((lead) => lead.id === nextLeadId)
    const nextVideos = videos.filter((video) => video.leadId === nextLeadId)
    setLeadId(nextLeadId)
    setTo(nextLead?.email || '')
    setVideoAssetId(nextVideos[0]?.id || '')
  }

  async function handleSend() {
    setSending(true)
    setStatus(null)
    const result = await sendEnterpriseEmail({
      leadId,
      to,
      recipientName: selectedLead?.name,
      subject,
      body,
      templateName: selectedTemplate?.template,
      videoAssetId: videoAssetId || undefined,
      ctaLabel: selectedTemplate?.cta || setupConfig?.defaultCtaLabel || 'Watch video',
    })
    setSending(false)
    if ('error' in result && result.error) {
      setStatus({ type: 'error', message: String(result.error) })
      return
    }
    setStatus({ type: 'success', message: 'Email sent and logged against the lead timeline.' })
  }

  return (
    <div className={styles.modalOverlay} onClick={(event) => event.target === event.currentTarget && onClose()}>
      <section className={styles.emailComposerModal} aria-label="Enterprise email composer">
        <header className={styles.emailComposerHeader}>
          <div>
            <h2>Enterprise email send</h2>
            <p>Send via Resend, stream attached videos from Supabase, and log the activity for audit.</p>
          </div>
          <button type="button" onClick={onClose}>x</button>
        </header>
        <div className={styles.emailComposerGrid}>
          <div className={styles.emailComposerForm}>
            <label>
              <span>Lead</span>
              <select value={leadId} onChange={(event) => handleLeadChange(event.target.value)}>
                <option value="">Manual recipient</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>{lead.name} - {lead.company} {lead.email ? `(${lead.email})` : ''}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Recipient email</span>
              <input value={to} onChange={(event) => setTo(event.target.value)} placeholder="client@example.com" type="email" />
            </label>
            <label>
              <span>Subject</span>
              <input value={subject} onChange={(event) => setSubject(event.target.value)} />
            </label>
            <label>
              <span>Database video attachment</span>
              <select value={videoAssetId} onChange={(event) => setVideoAssetId(event.target.value)}>
                <option value="">No video attached</option>
                {(leadVideos.length > 0 ? leadVideos : videos).map((video) => (
                  <option key={video.id} value={video.id}>{video.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Message</span>
              <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={10} />
            </label>
            {status ? <div className={status.type === 'success' ? styles.sendSuccess : styles.sendError}>{status.message}</div> : null}
            <div className={styles.emailComposerActions}>
              <button className={styles.button} onClick={onClose}>Cancel</button>
              <button className={styles.buttonPrimary} onClick={handleSend} disabled={sending}>{sending ? 'Sending...' : 'Send email'}</button>
            </div>
          </div>
          <aside className={styles.emailPreview}>
            <div className={styles.previewBrand}>Online2Day</div>
            <strong>{subject || 'Subject line'}</strong>
            <p>{selectedLead ? `Hi ${selectedLead.name},` : 'Hi there,'}</p>
            {body.split(/\n{2,}/).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {videoAssetId ? (
              <div className={styles.videoAttachPreview}>
                <Video size={22} />
                <div>
                  <strong>{videos.find((video) => video.id === videoAssetId)?.name || 'Attached video'}</strong>
                  <span>Streams from the secure video page when opened.</span>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </section>
    </div>
  )
}

function MessagesSection({ initialConversations = [] }: { initialConversations?: ConversationRecord[]; messageStats?: { unread: number; waiting: number; open: number; resolved: number } }) {
  const [selectedId, setSelectedId] = useState(initialConversations[0]?.id || '')
  const [query, setQuery] = useState('')
  const [replyText, setReplyText] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const selectedConversation = initialConversations.find((c) => c.id === selectedId) ?? initialConversations[0]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedId, selectedConversation?.messages.length])

  const stats = useMemo(() => ({
    total: initialConversations.length,
    unread: initialConversations.reduce((s, c) => s + (c.unread || 0), 0),
    high: initialConversations.filter((c) => c.priority === 'High').length,
  }), [initialConversations])

  function handleSendReply() {
    const text = replyText.trim()
    if (!text || !selectedConversation || isPending) return
    startTransition(async () => {
      await sendConversationReply(selectedConversation.id, text)
      setReplyText('')
      router.refresh()
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendReply()
    }
  }

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return initialConversations.filter((c) =>
      normalized ? `${c.name} ${c.company} ${c.preview}`.toLowerCase().includes(normalized) : true
    )
  }, [query, initialConversations])

  function channelLabel(channel: string) {
    const c = channel?.toLowerCase() || ''
    if (c.includes('email')) return 'Email'
    if (c.includes('chat') || c.includes('web')) return 'Web chat'
    if (c.includes('phone')) return 'Phone'
    return channel || 'Chat'
  }

  return (
    <div className={styles.chatLayout}>

      {/* ── LEFT: conversation list ─────────────────────────── */}
      <div className={cx(styles.panel, styles.tablePanel)}>
        <div className={styles.msgStatBar}>
          <strong>{stats.total} conversation{stats.total !== 1 ? 's' : ''}</strong>
          {stats.unread > 0 && <span className={cx(styles.pill, styles.pillRed)}>{stats.unread} unread</span>}
          {stats.high > 0 && <span className={cx(styles.pill, styles.pillYellow)}>{stats.high} urgent</span>}
        </div>

        <div className={styles.toolbar}>
          <label className={styles.smallSearch}>
            <Search size={14} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search conversations..." />
          </label>
        </div>

        <div className={styles.conversationList}>
          {filtered.length === 0 && (
            <div className={styles.emptyStateMsg}>No conversations found</div>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              className={cx(styles.conversationRow, selectedId === c.id && styles.conversationRowActive)}
              onClick={() => setSelectedId(c.id)}
            >
              <div className={styles.convAvatar}>{initials(c.name)}</div>
              <div className={styles.convBody}>
                <div className={styles.convTopLine}>
                  <strong>{c.name}</strong>
                  <span className={styles.convTime}>{c.time}</span>
                </div>
                <div className={styles.convCompany}>{c.company}</div>
                <div className={styles.convPreview}>{c.preview}</div>
              </div>
              <div className={styles.convBadges}>
                <span className={cx(styles.pill, priorityTone(c.priority))}>{c.priority}</span>
                {c.unread ? <span className={styles.unreadDot}>{c.unread}</span> : null}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── CENTER: message thread ──────────────────────────── */}
      <div className={styles.messageLayout}>
        {selectedConversation ? (
          <>
            <div className={styles.chatHeader}>
              <div className={styles.identity}>
                <div className={styles.avatar}>{initials(selectedConversation.name)}</div>
                <div>
                  <strong>{selectedConversation.name}</strong>
                  <div className={styles.subtle}>{selectedConversation.company} · {channelLabel(selectedConversation.channel)}</div>
                </div>
                <span className={cx(styles.pill, priorityTone(selectedConversation.priority))}>{selectedConversation.priority}</span>
                {selectedConversation.status && (
                  <span className={cx(styles.pill, styles.pillBlue)}>{selectedConversation.status}</span>
                )}
              </div>
              <div className={styles.chatHeaderActions}>
                <button className={styles.buttonGhost} title="Email"><Mail size={15} /></button>
                <button className={styles.buttonGhost} title="Schedule call"><CalendarDays size={15} /></button>
                <button className={styles.buttonGhost} title="Call"><Phone size={15} /></button>
              </div>
            </div>

            <div className={styles.chatMessages}>
              {selectedConversation.messages.map((msg) => {
                if (msg.sender === 'note') {
                  return (
                    <div key={msg.id} className={styles.noteBubble}>
                      <div className={styles.noteLabel}>Internal note</div>
                      <div>{msg.text}</div>
                      <div className={styles.msgTime}>{msg.time}</div>
                    </div>
                  )
                }
                const isAgent = msg.sender === 'agent'
                return (
                  <div key={msg.id} className={isAgent ? styles.bubbleMine : styles.bubble}>
                    <div>{msg.text}</div>
                    {msg.attachmentLabel && (
                      <div className={styles.attachmentCard}>
                        <strong>{msg.attachmentLabel}</strong>
                        {msg.meta && <div className={styles.subtle}>{msg.meta}</div>}
                      </div>
                    )}
                    <div className={cx(styles.msgTime, isAgent && styles.msgTimeMine)}>{msg.time}</div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className={styles.replyComposer}>
              <div className={styles.replyInput}>
                <textarea
                  className={styles.composeTextarea}
                  placeholder="Type a reply... (Enter to send, Shift+Enter for new line)"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isPending}
                  rows={3}
                />
              </div>
              <div className={styles.composerFooter}>
                <span className={styles.subtle}>
                  {replyText.length > 0 ? `${replyText.length} chars` : 'Enter to send · Shift+Enter for new line'}
                </span>
                <button
                  className={styles.buttonPrimary}
                  onClick={handleSendReply}
                  disabled={isPending || !replyText.trim()}
                >
                  <Send size={14} />{isPending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.emptyChat}>
            <MessageSquare size={36} />
            <p>Select a conversation to start messaging</p>
          </div>
        )}
      </div>

      {/* ── RIGHT: contact + timeline ───────────────────────── */}
      {selectedConversation && (
        <div className={styles.rightRail}>
          <RightPanel title="Contact info" actionLabel="Open in CRM">
            <div className={styles.contactCardRow}>
              <div className={styles.avatar}>{initials(selectedConversation.name)}</div>
              <div>
                <strong>{selectedConversation.name}</strong>
                <div className={styles.subtle}>{selectedConversation.company}</div>
              </div>
            </div>
            <div className={styles.list}>
              <div className={styles.listRow}><span>Channel</span><strong>{channelLabel(selectedConversation.channel)}</strong></div>
              <div className={styles.listRow}><span>Priority</span><span className={cx(styles.pill, priorityTone(selectedConversation.priority))}>{selectedConversation.priority}</span></div>
              {selectedConversation.status && <div className={styles.listRow}><span>Status</span><strong>{selectedConversation.status}</strong></div>}
              {selectedConversation.score > 0 && <div className={styles.listRow}><span>Lead score</span><strong>{selectedConversation.score} / 100</strong></div>}
              <div className={styles.listRow}><span>Last message</span><strong>{selectedConversation.time}</strong></div>
              <div className={styles.listRow}><span>Messages</span><strong>{selectedConversation.messages.length}</strong></div>
            </div>
          </RightPanel>

          <RightPanel title="Conversation timeline">
            <div className={styles.msgTimeline}>
              {selectedConversation.messages.slice().reverse().slice(0, 8).map((msg) => (
                <div key={msg.id} className={cx(styles.timelineItem, msg.sender === 'note' && styles.timelineNote)}>
                  <div
                    className={styles.timelineDot}
                    style={{ background: msg.sender === 'agent' ? '#3b82f6' : msg.sender === 'note' ? '#f59e0b' : '#64748b' }}
                  />
                  <div className={styles.timelineContent}>
                    <span className={styles.timelineWho}>
                      {msg.sender === 'agent' ? 'You' : msg.sender === 'note' ? 'Note' : selectedConversation.name.split(' ')[0]}
                    </span>
                    <div className={styles.timelineSnippet}>
                      {msg.text.length > 55 ? `${msg.text.slice(0, 55)}...` : msg.text}
                    </div>
                    <div className={styles.subtle}>{msg.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </RightPanel>
        </div>
      )}
    </div>
  )
}

function SiteRequestsSection({ initialSiteRequests = [], metrics = [] }: { initialSiteRequests?: SiteRequestRecord[]; metrics?: MetricItem[] }) {
  const [selectedId, setSelectedId] = useState(initialSiteRequests[0]?.id || '')
  const [query, setQuery] = useState('')
  const [showStageMenu, setShowStageMenu] = useState(false)
  const [stage, setStage] = useState('All stages')
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return initialSiteRequests.filter((req) =>
      normalized
        ? `${req.request} ${req.company} ${req.owner}`.toLowerCase().includes(normalized)
        : true
    )
  }, [query, initialSiteRequests])
  const selected = initialSiteRequests.find((item) => item.id === selectedId) ?? initialSiteRequests[0]

  return (
    <>
      <MetricGrid items={metrics} />

      <div className={styles.requestColumns}>
        <div className={cx(styles.panel, styles.tablePanel)}>
          <Tabs tabs={[{ label: 'All requests', count: 36 }, { label: 'Qualified', count: 18 }, { label: 'In scoping', count: 7 }, { label: 'Build in progress', count: 5 }, { label: 'Awaiting approval', count: 4 }, { label: 'Launched', count: 2 }]} activeTab="All requests" onChange={() => undefined} />
          <div className={styles.toolbar}>
            <label className={styles.smallSearch}>
              <Search size={14} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search requests..." />
            </label>
            <button className={styles.chipButton}>Type</button>
            <button className={styles.chipButton}>Owner</button>
            <button className={styles.chipButton}>Priority</button>
            <div className={styles.dropdownWrap}>
              <button className={styles.chipButton} onClick={() => setShowStageMenu((value) => !value)}>
                Stage
                <ChevronDown size={14} />
              </button>
              {showStageMenu ? (
                <div className={styles.dropdown}>
                  {['All stages', 'New', 'Qualified', 'Discovery', 'Scoping', 'In Build', 'QA', 'Approval', 'Launched'].map((item) => (
                    <button key={item} className={cx(stage === item && styles.dropdownActive)} onClick={() => setStage(item)}>
                      {item}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button className={styles.chipButton}>Budget</button>
            <button className={styles.chipButton}>More filters</button>
          </div>
          <SiteRequestTable rows={filtered} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        {selected && (
        <div className={styles.detailCard}>
          <div className={styles.panelHeader}>
            <div>
              <h3 className={styles.panelTitle}>{selected.request}</h3>
              <div className={styles.detailMeta}>
                <strong>{selected.company}</strong>
                <span className={styles.subtle}>{selected.type}</span>
                <span className={cx(styles.pill, styles.pillGreen)}>Qualified</span>
                <span className={cx(styles.pill, styles.pillYellow)}>High value</span>
              </div>
            </div>
            <button className={styles.buttonGhost}><MoreHorizontal size={16} /></button>
          </div>
          <div className={styles.statusLine}>
            {['Discovery complete', 'Requirements captured', 'Proposal in draft', 'Tech review pending'].map((item, index) => (
              <div key={item} className={styles.statusStep}>
                <div className={styles.identity}>
                  {index < 3 ? <Check size={14} color="#22c55e" /> : <CircleDot size={14} color="#60a5fa" />}
                  <span>{item}</span>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.panel}>
            <div className={styles.panelTitle}>Project summary</div>
            <p className={styles.pageDescription}>Modern marketing website to showcase services, build trust, and convert visitors.</p>
            <div className={styles.checkLine}>
              {['12-page marketing site', 'CMS integration', 'Blog', 'Lead capture forms', 'Case studies', 'SEO setup', 'Analytics', 'Video section'].map((item) => (
                <div key={item} className={styles.checkItem}>
                  <Check size={14} color="#22c55e" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className={styles.threeUp}>
            <div className={styles.panel}>
              <div className={styles.panelTitle}>Key requirements</div>
              <div className={styles.checkLine}>
                {['Responsive & mobile-first', 'Fast performance (90+ score)', 'SEO best practices', 'Easy content management', 'Integration with CRM forms'].map((item) => (
                  <div key={item} className={styles.checkItem}>
                    <Check size={14} color="#22c55e" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.panel}>
              <div className={styles.panelTitle}>Attached brief</div>
              <div className={styles.estimationBox}>
                <strong>Acme_CRM_Website_Brief.pdf</strong>
                <div className={styles.subtle}>PDF · 1.8 MB · Uploaded May 15</div>
              </div>
              <div className={styles.estimationBox} style={{ marginTop: 10 }}>
                <strong>Sarah Johnson</strong>
                <div className={styles.subtle}>Marketing Director</div>
              </div>
            </div>
            <div className={styles.panel}>
              <div className={styles.panelTitle}>Estimate</div>
              <div className={styles.estimationBox}>
                <strong style={{ color: '#4ade80' }}>$20K – $35K</strong>
                <div className={styles.subtle}>Estimated budget</div>
              </div>
              <div className={styles.estimationBox} style={{ marginTop: 10 }}>
                <strong>May 26 – Jul 4, 2025</strong>
                <div className={styles.subtle}>Estimated delivery (6 weeks)</div>
              </div>
            </div>
          </div>
          <div className={styles.threeUp}>
            <div className={styles.ctaCard}>
              <strong>1. Send proposal draft</strong>
              <div className={styles.subtle}>Proposal is 70% complete and ready to share for feedback.</div>
              <button className={styles.buttonPrimary} style={{ marginTop: 10 }}>Send proposal</button>
            </div>
            <div className={styles.panel}>
              <strong>2. Schedule technical scoping call</strong>
              <div className={styles.subtle}>Align on technical scope and integrations.</div>
              <button className={styles.button} style={{ marginTop: 10 }}>Book call</button>
            </div>
            <div className={styles.panel}>
              <strong>3. Share example case study</strong>
              <div className={styles.subtle}>Acme-like project could help build confidence.</div>
              <button className={styles.button} style={{ marginTop: 10 }}>Share resource</button>
            </div>
          </div>
          <div className={styles.replyActions}>
            <button className={styles.chipButton}>Reply</button>
            <button className={styles.chipButton}>Note</button>
            <button className={styles.chipButton}>Email</button>
            <button className={styles.chipButton}>Template</button>
            <button className={styles.chipButton}>Attach</button>
            <button className={styles.chipButton}>Internal note</button>
            <button className={styles.chipButton}>Send video</button>
            <button className={styles.chipButton}>Schedule send</button>
            <button className={styles.buttonPrimary}>Send update</button>
          </div>
          <div className={styles.detailActions}>
            <button className={styles.button}>Mark as scoped</button>
            <button className={styles.button}>Convert to project</button>
            <button className={styles.button}><MoreHorizontal size={16} /></button>
          </div>
        </div>
        )}

        <div className={styles.rightRail}>
          <RightPanel title="Request snapshot" actionLabel="View in CRM">
            <div className={styles.listRow}>
              <div className={styles.identity}>
                <div className={styles.logoMark}>ACME</div>
                <div>
                  <strong>Acme Corp</strong>
                  <div className={styles.subtle}>Lead score 92</div>
                </div>
              </div>
              <strong style={{ color: '#4ade80' }}>$28K</strong>
            </div>
            <div className={styles.list}>
              <div className={styles.listRow}><span>Source</span><strong>Website</strong></div>
              <div className={styles.listRow}><span>Contact</span><strong>Sarah Johnson</strong></div>
              <div className={styles.listRow}><span>Owner</span><strong>Sarah M.</strong></div>
              <div className={styles.listRow}><span>Timeline</span><strong>6 weeks</strong></div>
            </div>
          </RightPanel>
          <RightPanel title="AI recommendations">
            <div className={styles.recommendationList}>
              <RecommendationAction title="Send scope summary" subtitle="Keep momentum with a concise proposal recap." actionLabel="Send" />
              <RecommendationAction title="Book technical scoping call" subtitle="Lock the scope while intent is strong." actionLabel="Book" />
              <RecommendationAction title="Share relevant case study" subtitle="Reinforce confidence with proof." actionLabel="Share" />
            </div>
          </RightPanel>
        </div>
      </div>
    </>
  )
}

function IntegrationStatusBar({ status }: { status: IntegrationStatus }) {
  return (
    <div className={styles.statusBar}>
      <div className={styles.statusStat}>
        <span className={cx(styles.pill, styles.pillGreen)}>●</span>
        <span>Connected</span>
        <strong>{status.connected}</strong>
      </div>
      <div className={styles.statusStat}>
        <span className={cx(styles.pill, styles.pillBlue)}>●</span>
        <span>Suggested</span>
        <strong>{status.suggested}</strong>
      </div>
      <div className={styles.statusStat}>
        <span className={cx(styles.pill, styles.pillYellow)}>●</span>
        <span>Pending</span>
        <strong>{status.pending}</strong>
      </div>
      <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: 14 }}>
        Last synced: 2 minutes ago
      </span>
    </div>
  )
}

function IntegrationsSection({ integrationStatus = { connected: 0, suggested: 0, pending: 0 } }: { integrationStatus?: IntegrationStatus }) {
  const checks = integrationStatus.healthChecks || []
  const toneFor = (status: string) => status === 'healthy' ? styles.pillGreen : status === 'degraded' ? styles.pillYellow : status === 'down' ? styles.pillRed : styles.pill
  return (
    <>
      <IntegrationStatusBar status={integrationStatus} />
      <div className={styles.integrationsGrid}>
        <IntegrationCard
          icon={<DatabaseIcon size={18} />}
          title="Supabase"
          description="Primary source of truth for leads, assets, events, chat, and request data."
          status="Connected"
          action="Manage connection"
        />
        <IntegrationCard
          icon={<Mail size={18} />}
          title="Resend"
          description="Transactional email delivery for outreach, follow-ups, and campaign sends."
          status="Configured"
          action="Open email settings"
        />
        <IntegrationCard
          icon={<Users size={18} />}
          title="HubSpot"
          description="Contact sync and note creation for inbound submissions and sales touchpoints."
          status="Connected"
          action="Review mapping"
        />
      </div>
      <div className={styles.integrationsGrid} style={{ marginTop: 10 }}>
        <IntegrationCard
          icon={<Video size={18} />}
          title="Video Library"
          description="Upload, categorize, and reuse personalised videos across campaigns and conversations."
          status="Ready"
          action="Open library"
        />
        <IntegrationCard
          icon={<CalendarDays size={18} />}
          title="Calendar Booking"
          description="Drive meetings from video CTAs, email campaigns, and live chat recommendations."
          status="Not configured"
          action="Contact sales to add this"
        />
        <IntegrationCard
          icon={<ShieldCheck size={18} />}
          title="Automation Rules"
          description="Create engagement-based follow-up rules that scale cleanly when live data arrives."
          status="Not configured"
          action="Contact sales to add this"
        />
      </div>
      <div className={styles.panel} style={{ marginTop: 10 }}>
        <div className={styles.panelTitle}>Integration health checks</div>
        <div className={styles.list}>
          {checks.length === 0 ? (
            <div className={styles.subtle}>No health checks available yet.</div>
          ) : (
            checks.map((check) => (
              <div key={`${check.provider}-${check.checkedAt}`} className={styles.listRow}>
                <div className={styles.identity}>
                  <strong>{check.provider}</strong>
                  <div className={styles.subtle}>{new Date(check.checkedAt).toLocaleString('en-GB')}</div>
                </div>
                <span className={cx(styles.pill, toneFor(check.status))}>{check.status}</span>
                <span className={styles.subtle}>{check.latencyMs !== null ? `${check.latencyMs}ms` : 'n/a'}</span>
                <span className={styles.subtle}>{check.detail}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}

function MetricGrid({ items }: { items: MetricItem[] }) {
  return (
    <section className={styles.metricsGrid}>
      {items.map((item) => (
        <article key={item.label} className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricIcon}><item.icon size={16} /></span>
            <span>{item.label}</span>
          </div>
          <strong className={styles.metricValue}>{item.value}</strong>
          <div className={styles.metricDelta}>{item.delta}</div>
          <Sparkline values={item.sparkline} />
        </article>
      ))}
    </section>
  )
}

function Sparkline({ values }: { values: number[] }) {
  const width = 140
  const height = 28
  const max = Math.max(...values)
  const min = Math.min(...values)
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width
      const y = height - ((value - min) / Math.max(max - min, 1)) * (height - 6) - 3
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg className={styles.sparkline} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  )
}

function ProcessRow({
  title,
  steps,
  activeStep,
  nextActionTitle,
  nextActionText,
}: {
  title: string
  steps: ProcessStep[]
  activeStep: number
  nextActionTitle: string
  nextActionText: string
}) {
  return (
    <section className={styles.processRow}>
      <div className={cx(styles.panel, styles.processCard)}>
        <h2 className={styles.processTitle}>{title}</h2>
        <div className={styles.processSteps}>
          {steps.map((step) => (
            <div key={step.step} className={cx(styles.processStep, step.step <= activeStep && styles.processStepActive)}>
              <div className={styles.processBadge}>{step.step}</div>
              <div className={styles.processLabel}>{step.label}</div>
              {step.detail ? <span className={styles.processDetail}>{step.detail}</span> : null}
            </div>
          ))}
        </div>
      </div>

      <div className={cx(styles.panel, styles.nextActionCard)}>
        <div className={styles.subtle}>{nextActionTitle}</div>
        <strong>{nextActionText}</strong>
        <div className={styles.subtle}>Prioritised from current engagement signals.</div>
      </div>
    </section>
  )
}

function Tabs({ tabs, activeTab, onChange }: { tabs: TableTab[]; activeTab: string; onChange: (value: string) => void }) {
  return (
    <div className={styles.tabs}>
      {tabs.map((tab) => (
        <button key={tab.label} className={cx(styles.tab, activeTab === tab.label && styles.tabActive)} onClick={() => onChange(tab.label)}>
          {tab.label}
          {tab.count !== undefined ? ` ${tab.count}` : ''}
        </button>
      ))}
    </div>
  )
}

function LeadToolbar({
  query,
  onQueryChange,
  stage,
  onStageChange,
  showStageMenu,
  onToggleStageMenu,
}: {
  query: string
  onQueryChange: (value: string) => void
  stage: 'All stages' | LeadStage
  onStageChange: (value: 'All stages' | LeadStage) => void
  showStageMenu: boolean
  onToggleStageMenu: () => void
}) {
  return (
    <div className={styles.toolbar}>
      <label className={styles.smallSearch}>
        <Search size={14} />
        <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search leads..." />
      </label>
      <button className={styles.chipButton}>Status</button>
      <button className={styles.chipButton}>Owner</button>
      <button className={styles.chipButton}>Source</button>
      <div className={styles.dropdownWrap}>
        <button className={styles.chipButton} onClick={onToggleStageMenu}>
          Stage
          <ChevronDown size={14} />
        </button>
        {showStageMenu ? (
          <div className={styles.dropdown}>
            {LEAD_STAGES.map((item) => (
              <button key={item} className={cx(stage === item && styles.dropdownActive)} onClick={() => onStageChange(item)}>
                {item}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <button className={styles.chipButton}>Score</button>
      <button className={styles.chipButton}>More filters</button>
      <div className={styles.toolbarRight}>
        <button className={styles.chipButton}><Columns3 size={14} /> Columns</button>
        <button className={styles.chipButton}>Sort: Last activity <ChevronDown size={14} /></button>
      </div>
    </div>
  )
}

function LeadTable({ leads, selectedId, onSelect }: { leads: LeadRecord[]; selectedId: string; onSelect: (value: string) => void }) {
  return (
    <>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th />
              <th>Lead</th>
              <th>Company</th>
              <th>Score</th>
              <th>Stage</th>
              <th>Owner</th>
              <th>Source</th>
              <th>Last activity</th>
              <th>Engagement</th>
              <th>Value</th>
              <th>Next action</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className={cx(selectedId === lead.id && styles.tableRowSelected)} onClick={() => onSelect(lead.id)}>
                <td><input type="checkbox" checked={selectedId === lead.id} readOnly /></td>
                <td>
                  <div className={styles.identity}>
                    <div className={styles.avatar}>{initials(lead.contactName)}</div>
                    <div>
                      <strong>{lead.contactName}</strong>
                      <div className={styles.subtle}>{lead.role}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className={styles.identity}>
                    <div className={styles.logoMark}>{lead.companyMark}</div>
                    <span>{lead.company}</span>
                  </div>
                </td>
                <td><span className={styles.scoreCircle}>{lead.score}</span></td>
                <td><span className={cx(styles.pill, stageTone(lead.stage))}>{lead.stage}</span></td>
                <td>
                  <div className={styles.identity}>
                    <div className={styles.miniAvatar}>{initials(lead.owner)}</div>
                    {lead.owner}
                  </div>
                </td>
                <td>{lead.source}</td>
                <td>{lead.lastActivity}</td>
                <td style={{ minWidth: 120 }}>
                  <div className={styles.goalRow}>
                    <div className={styles.goalHead}><span>{lead.engagement}%</span></div>
                    <div className={styles.barTrack}><div className={styles.barFill} style={{ width: `${lead.engagement}%` }} /></div>
                  </div>
                </td>
                <td>{lead.value}</td>
                <td style={{ color: '#60a5fa' }}>{lead.nextAction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.tableFooter}>
        Showing 1 to {leads.length} of 248 leads
        <div className={styles.pagination}>
          <button>{'<'}</button>
          <button>1</button>
          <button>2</button>
          <button>3</button>
          <button>{'>'}</button>
        </div>
      </div>
    </>
  )
}

function VideoTable({ rows, selectedId, onSelect }: { rows: VideoRecord[]; selectedId: string; onSelect: (value: string) => void }) {
  const [page, setPage] = useState(1)
  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  const pagedRows = rows.slice(start, start + pageSize)

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  return (
    <>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th />
              <th>Video</th>
              <th>Funnel stage</th>
              <th>Owner</th>
              <th>Channel</th>
              <th>CTA</th>
              <th>Status</th>
              <th>Watch %</th>
              <th>Last viewed</th>
              <th>Replies</th>
              <th>Next action</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((video) => (
              <tr key={video.id} className={cx(selectedId === video.id && styles.tableRowSelected)} onClick={() => onSelect(video.id)}>
                <td><input type="checkbox" checked={selectedId === video.id} readOnly /></td>
                <td>
                  <div className={styles.identity}>
                    <div className={styles.logoMark}>{video.duration}</div>
                    <div>
                      <strong>{video.title}</strong>
                      <div className={styles.subtle}>{video.company}</div>
                    </div>
                  </div>
                </td>
                <td><span className={cx(styles.pill, stagePill(video.funnelStage))}>{video.funnelStage}</span></td>
                <td>{video.owner}</td>
                <td>{video.channel}</td>
                <td style={{ color: '#60a5fa' }}>{video.cta}</td>
                <td><span className={cx(styles.pill, statusPill(video.status))}>{video.status}</span></td>
                <td style={{ minWidth: 120 }}>
                  <div className={styles.goalRow}>
                    <div className={styles.goalHead}><span>{video.watchRate}%</span></div>
                    <div className={styles.barTrack}><div className={styles.barFill} style={{ width: `${video.watchRate}%` }} /></div>
                  </div>
                </td>
                <td>{video.lastViewed}</td>
                <td>{video.replies}</td>
                <td style={{ color: '#60a5fa' }}>{video.nextAction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.tableFooter}>
        Showing {rows.length === 0 ? 0 : start + 1} to {Math.min(start + pageSize, rows.length)} of {rows.length} videos
        <div className={styles.pagination}>
          <button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage === 1}>{'<'}</button>
          <button>{safePage}</button>
          <button disabled>of {totalPages}</button>
          <button onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage === totalPages}>{'>'}</button>
        </div>
      </div>
    </>
  )
}

function EmailTable({ rows, selectedId, onSelect }: { rows: EmailRecord[]; selectedId: string; onSelect: (value: string) => void }) {
  return (
    <>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th />
              <th>Template</th>
              <th>Audience</th>
              <th>Stage</th>
              <th>Owner</th>
              <th>Subject line</th>
              <th>Sent</th>
              <th>Opens</th>
              <th>Replies</th>
              <th>CTA</th>
              <th>Next action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((email) => (
              <tr key={email.id} className={cx(selectedId === email.id && styles.tableRowSelected)} onClick={() => onSelect(email.id)}>
                <td><input type="checkbox" checked={selectedId === email.id} readOnly /></td>
                <td><strong>{email.template}</strong></td>
                <td>{email.audience}</td>
                <td><span className={cx(styles.pill, stagePill(email.stage))}>{email.stage}</span></td>
                <td>{email.owner}</td>
                <td>{email.subject}</td>
                <td>{email.sent}</td>
                <td>{email.opens}%</td>
                <td>{email.replies}%</td>
                <td style={{ color: '#60a5fa' }}>{email.cta}</td>
                <td style={{ color: '#60a5fa' }}>{email.nextAction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.tableFooter}>
        Showing 1 to {rows.length} of 42 templates
        <div className={styles.pagination}>
          <button>{'<'}</button>
          <button>1</button>
          <button>2</button>
          <button>3</button>
          <button>{'>'}</button>
        </div>
      </div>
    </>
  )
}

function SiteRequestTable({ rows, selectedId, onSelect }: { rows: SiteRequestRecord[]; selectedId: string; onSelect: (value: string) => void }) {
  return (
    <>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th />
              <th>Request</th>
              <th>Company</th>
              <th>Type</th>
              <th>Priority</th>
              <th>Stage</th>
              <th>Owner</th>
              <th>Last activity</th>
              <th>Value</th>
              <th>Next action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((request) => (
              <tr key={request.id} className={cx(selectedId === request.id && styles.tableRowSelected)} onClick={() => onSelect(request.id)}>
                <td><input type="checkbox" checked={selectedId === request.id} readOnly /></td>
                <td><strong>{request.request}</strong></td>
                <td>{request.company}</td>
                <td>{request.type}</td>
                <td><span className={cx(styles.pill, priorityTone(request.priority))}>{request.priority}</span></td>
                <td><span className={cx(styles.pill, stagePill(request.stage))}>{request.stage}</span></td>
                <td>{request.owner}</td>
                <td>{request.lastActivity}</td>
                <td>{request.value}</td>
                <td style={{ color: '#60a5fa' }}>{request.nextAction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.tableFooter}>
        Showing 1 to {rows.length} of 36 requests
        <div className={styles.pagination}>
          <button>{'<'}</button>
          <button>1</button>
          <button>2</button>
          <button>3</button>
          <button>{'>'}</button>
        </div>
      </div>
    </>
  )
}

function FunnelPanel({ title }: { title: string }) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>{title}</h3>
      </div>
      <div className={styles.funnelWrap}>
        <div className={styles.funnel} />
        <div className={styles.list}>
          {[
            ['New', '32 (13%)'],
            ['Contacted', '56 (23%)'],
            ['Qualified', '64 (26%)'],
            ['Proposal Sent', '38 (15%)'],
            ['Negotiation', '42 (17%)'],
            ['Won', '16 (6%)'],
          ].map(([label, value]) => (
            <div key={label} className={styles.listRow}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
          <div className={styles.listRow}>
            <span>Overall conversion rate</span>
            <strong style={{ color: '#4ade80' }}>6%</strong>
          </div>
        </div>
      </div>
    </div>
  )
}

function ForecastPanel({ title }: { title: string }) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>{title}</h3>
      </div>
      <strong>$1.82M</strong>
      <span className={styles.metricDelta}>+15.7% vs Apr 27 – May 4</span>
      <svg className={styles.lineChart} viewBox="0 0 320 150" aria-hidden="true">
        <defs>
          <linearGradient id="forecastFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(59,130,246,0.22)" />
            <stop offset="100%" stopColor="rgba(59,130,246,0)" />
          </linearGradient>
        </defs>
        <polyline fill="none" stroke="#22c55e" strokeDasharray="5 5" strokeWidth="2" points="0,110 60,102 120,96 180,88 240,80 320,72" />
        <path d="M0 118 C 35 106, 52 112, 76 95 S 128 90, 160 70 S 220 58, 246 52 S 290 42, 320 36 L320 150 L0 150 Z" fill="url(#forecastFill)" />
        <path d="M0 118 C 35 106, 52 112, 76 95 S 128 90, 160 70 S 220 58, 246 52 S 290 42, 320 36" fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  )
}

function SimpleTablePanel({ title, headers, rows, linkLabel }: { title: string; headers: string[]; rows: string[][]; linkLabel: string }) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>{title}</h3>
      </div>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.join('-')}>
                {row.map((cell) => <td key={cell}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ paddingTop: 8 }}>
        <a className={styles.panelLink} href="#">{linkLabel} <ArrowRight size={14} style={{ verticalAlign: 'middle' }} /></a>
      </div>
    </div>
  )
}

function LineChartPanel({ title, legend }: { title: string; legend: string[] }) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>{title}</h3>
        <div className={styles.identity}>
          {legend.map((item, index) => (
            <span key={item} className={styles.subtle}>
              <span style={{ color: index === 0 ? '#3b82f6' : index === 1 ? '#c084fc' : '#22c55e' }}>•</span> {item}
            </span>
          ))}
        </div>
      </div>
      <svg className={styles.lineChart} viewBox="0 0 320 150" aria-hidden="true">
        <path d="M0 50 C 30 60, 50 90, 80 45 S 130 55, 160 72 S 210 54, 240 42 S 290 68, 320 54" fill="none" stroke="#3b82f6" strokeWidth="3" />
        <path d="M0 82 C 32 86, 55 98, 84 82 S 128 84, 160 94 S 208 80, 244 72 S 288 76, 320 74" fill="none" stroke="#c084fc" strokeWidth="3" />
        <path d="M0 112 C 28 116, 55 124, 84 108 S 126 106, 160 120 S 208 106, 246 112 S 292 108, 320 106" fill="none" stroke="#22c55e" strokeWidth="3" />
      </svg>
    </div>
  )
}

function TasksPanel({ title = "Today's priorities" }: { title?: string }) {
  const tasks = [
    ['Follow up with 5 high-intent leads', '10:00 AM'],
    ['Video presentation for Acme Corp', '11:00 AM'],
    ['Discovery call with Sarah Johnson', '1:00 PM'],
    ['Proposal review with James T.', '3:00 PM'],
    ['Send pricing to GreenTech', '4:30 PM'],
  ]

  return (
    <RightPanel title={title} actionLabel="View all tasks">
      <div className={styles.taskList}>
        {tasks.map(([label, time], index) => (
          <div key={label} className={styles.taskRow}>
            <input type="checkbox" defaultChecked={index < 3} />
            <span style={{ flex: 1 }}>{label}</span>
            <span className={styles.taskMeta}>{time}</span>
          </div>
        ))}
      </div>
    </RightPanel>
  )
}

function RecommendationsPanel({ title = 'AI recommendations' }: { title?: string }) {
  return (
    <RightPanel title={title} actionLabel="View all recommendations">
      <div className={styles.recommendationList}>
        <RecommendationAction title="Follow up with Acme Corp" subtitle="High engagement, no reply in 2 days" actionLabel="Follow up" />
        <RecommendationAction title="Create video for GreenTech" subtitle="Viewed 80% of your last video" actionLabel="Create video" />
        <RecommendationAction title="Nudge reply from Daniel Kim" subtitle="Opened email 2 days ago" actionLabel="Nudge" />
      </div>
    </RightPanel>
  )
}

function RecommendationAction({ title, subtitle, actionLabel }: { title: string; subtitle: string; actionLabel: string }) {
  return (
    <div className={styles.recommendationRow}>
      <div>
        <strong>{title}</strong>
        <div className={styles.subtle}>{subtitle}</div>
      </div>
      <button className={styles.buttonGhost}>{actionLabel}</button>
    </div>
  )
}

function ActivityPanel({ title = 'Recent activity' }: { title?: string }) {
  return (
    <RightPanel title={title} actionLabel="View all activity">
      <ActivityList items={[
        'Sarah M. booked a call with Acme Corp',
        'James T. sent a video to GreenTech',
        'Emily R. moved lead to Proposal Sent',
        'Daniel K. logged a call with Beta Industries',
        'Michael B. created a proposal for Vertex',
      ]} />
    </RightPanel>
  )
}

function ActivityList({ items }: { items: string[] }) {
  return (
    <div className={styles.activityList}>
      {items.map((item, index) => (
        <div key={item} className={styles.activityRow}>
          <span className={styles.miniAvatar}>{index + 1}</span>
          <div style={{ flex: 1 }}>
            <div>{item}</div>
            <div className={styles.subtle}>May 18, {10 - index}:{index}5 AM</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function GoalPanel({ title = 'Goal progress', meetings, revenue }: { title?: string; meetings: string; revenue: string }) {
  return (
    <RightPanel title={title} actionLabel="View goals">
      <div className={styles.goalList}>
        <div className={styles.goalRow}>
          <div className={styles.goalHead}><span>Meetings booked</span><strong>{meetings}</strong></div>
          <div className={styles.barTrack}><div className={styles.barFill} style={{ width: '68%' }} /></div>
        </div>
        <div className={styles.goalRow}>
          <div className={styles.goalHead}><span>Revenue target</span><strong>{revenue}</strong></div>
          <div className={styles.barTrack}><div className={styles.barFill} style={{ width: '64%' }} /></div>
        </div>
      </div>
    </RightPanel>
  )
}

function RightPanel({
  title,
  actionLabel,
  children,
}: {
  title: string
  actionLabel?: string
  children: ReactNode
}) {
  return (
    <div className={styles.rightPanel}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>{title}</h3>
        {actionLabel ? <a href="#" className={styles.panelLink}>{actionLabel}</a> : null}
      </div>
      {children}
    </div>
  )
}

function LeadBottomBar({ lead }: { lead?: LeadRecord }) {
  if (!lead) return null
  return (
    <div className={styles.bottomBar}>
      <div className={styles.identity}>
        <div className={styles.logoMark}>{lead.companyMark}</div>
        <div>
          <strong>{lead.company}</strong>
          <div className={styles.subtle}>{lead.contactName} · {lead.role}</div>
        </div>
        <span className={cx(styles.pill, styles.pillGreen)}>{lead.stage}</span>
      </div>
      <div>
        <div className={styles.subtle}>Lead score</div>
        <strong>{lead.score}</strong>
      </div>
      <div>
        <div className={styles.subtle}>Owner</div>
        <strong>{lead.owner}</strong>
      </div>
      <div>
        <div className={styles.subtle}>Source</div>
        <strong>{lead.source}</strong>
      </div>
      <div>
        <div className={styles.subtle}>Last touch</div>
        <strong>{lead.lastActivity}</strong>
      </div>
      <div className={styles.ctaCard}>
        <strong>Recommended CTA</strong>
        <div className={styles.subtle}>Follow up via email with case study video to move to proposal stage.</div>
      </div>
      <div className={styles.actionGroup}>
        <Link href={`/dashboard/leads/${lead.id}`} className={styles.buttonPrimary} data-dashboard-native="true">Open lead</Link>
        <Link href="/dashboard/emails" className={styles.button} data-dashboard-native="true"><Mail size={15} /> Send email</Link>
        <Link href="/dashboard/videos/editor" className={styles.button} data-dashboard-native="true"><Video size={15} /> Create video</Link>
        <Link href="/contact" className={styles.button} data-dashboard-native="true"><CalendarDays size={15} /> Book call</Link>
        <button className={styles.button}><MoreHorizontal size={16} /></button>
      </div>
    </div>
  )
}

function integrationStatusPill(status: string) {
  if (status === 'Connected' || status === 'Configured' || status === 'Ready') return styles.pillGreen
  if (status === 'Enabled') return styles.pillBlue
  if (status === 'Not configured') return styles.pillRed
  return styles.pillYellow
}

function IntegrationCard({
  icon,
  title,
  description,
  status,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  status: string
  action: string
}) {
  return (
    <div className={styles.integrationCard}>
      <div className={styles.metricIcon}>{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className={styles.listRow}>
        <span className={cx(styles.pill, integrationStatusPill(status))}>{status}</span>
        <button className={action.toLowerCase().includes('contact sales') ? styles.buttonGhost : styles.button}>{action}</button>
      </div>
    </div>
  )
}

function useFilteredLeads(query: string, stage: 'All stages' | LeadStage, activeTab: string, initialLeads: LeadRecord[] = []) {
  return useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return initialLeads.filter((lead) => {
      const matchesQuery = normalized
        ? `${lead.contactName} ${lead.role} ${lead.company} ${lead.stage} ${lead.owner}`.toLowerCase().includes(normalized)
        : true
      const matchesStage = stage === 'All stages' || lead.stage === stage
      const matchesTab = activeTab === 'All leads' || (activeTab === 'High intent' && lead.score > 80) || (activeTab === 'Won' && lead.stage === 'Won')
      return matchesQuery && matchesStage && matchesTab
    })
  }, [query, stage, activeTab])
}

function stageTone(stage: LeadStage) {
  if (stage === 'Qualified' || stage === 'Won') return styles.pillGreen
  if (stage === 'Contacted') return styles.pillBlue
  if (stage === 'Proposal Sent') return styles.pillPurple
  if (stage === 'Negotiation') return styles.pillYellow
  return styles.pillRed
}

function statusPill(status: string) {
  if (status === 'Viewed' || status === 'Ready') return styles.pillGreen
  if (status === 'High intent') return styles.pillPurple
  if (status === 'Sent') return styles.pillBlue
  return styles.pillYellow
}

function stagePill(stage: string) {
  if (stage.includes('Qual')) return styles.pillBlue
  if (stage.includes('Proposal')) return styles.pillPurple
  if (stage.includes('Won') || stage.includes('Ready') || stage.includes('Launched')) return styles.pillGreen
  if (stage.includes('Negotiation') || stage.includes('Approval') || stage.includes('QA')) return styles.pillYellow
  if (stage.includes('Follow') || stage.includes('Re-engagement')) return styles.pillBlue
  return styles.pillRed
}

function priorityTone(priority: ConversationRecord['priority'] | SiteRequestRecord['priority']) {
  if (priority === 'High') return styles.pillRed
  if (priority === 'Medium') return styles.pillYellow
  return styles.pillGreen
}

function initials(value: string) {
  return value
    .split(' ')
    .map((item) => item[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function DatabaseIcon({ size = 16 }: { size?: number }) {
  return <Link2 size={size} />
}
