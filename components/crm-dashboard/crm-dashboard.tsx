'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { ComponentType, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Columns3,
  DollarSign,
  Download,
  ExternalLink,
  Inbox,
  Link2,
  Mail,
  MessageSquare,
  MonitorPlay,
  PenSquare,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Upload,
  UserPlus,
  UserRoundCheck,
  Users,
  Video,
  WandSparkles,
  X,
} from 'lucide-react'
import styles from './dashboard.module.css'
import { createEmailTemplate, deleteEmailTemplate, sendEnterpriseEmail, updateEmailTemplate } from '@/lib/actions/email-actions'
import { markConversationRead, sendConversationReply } from '@/lib/actions/message-actions'
import { deleteVideoAsset } from '@/lib/actions/video-actions'
import { updateSiteRequest } from '@/lib/actions/site-request-actions'
import { openExternalSafely } from '@/lib/security/external-links'
import { DashboardSidebar } from '@/components/leads/DashboardSidebar'
import type {
  CrmSetupConfig,
  ConversationRecord,
  CrmDashboardProps,
  DashboardSection,
  EmailRecord,
  EmailSendRecord,
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

const MailboxWorkspace = dynamic(() => import('./mailbox-workspace'), { ssr: false, loading: () => <div className={styles.panel} style={{ minHeight: 240, display: 'grid', placeItems: 'center' }}>Loading secure mailbox…</div> })

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
      'Ready to share': MonitorPlay,
      'Total views': Activity,
      'Draft projects': PenSquare,
    },
    email: {
      'Templates': Mail,
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
      { label: 'Build or record video', icon: WandSparkles, href: '/dashboard/videos/editor' },
      { label: 'Upload existing video', icon: Upload, href: '/dashboard/videos/upload' },
    ],
  },
  emails: {
    title: 'Emails',
    description: 'Send, test and track emails that move leads closer to sale.',
    searchPlaceholder: 'Search leads, templates, campaigns...',
    createLabel: 'Create / Add',
    createItems: [],
  },
  messages: {
    title: 'Messages',
    description: 'Manage live conversations, qualify leads, and convert chat into revenue.',
    searchPlaceholder: 'Search conversations, leads, companies...',
    createLabel: 'Create / Add',
    createItems: [],
  },
  'site-requests': {
    title: 'Site Requests',
    description: 'Manage incoming website and web app requests from enquiry to launch.',
    searchPlaceholder: 'Search requests, companies, owners...',
    createLabel: 'Create / Add',
    createItems: [],
  },
  integrations: {
    title: 'Integrations',
    description: 'Connect your CRM workflows to email, automation, analytics, and storage.',
    searchPlaceholder: 'Search integrations, apps...',
    createLabel: 'Add Integration',
    createItems: [],
  },
}

export function CrmDashboard({
  section,
  initialLeads = [],
  initialVideos = [],
  initialEmails = [],
  recentEmailSends = [],
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
  const [isCreateOpen, setIsCreateOpen] = useState(false)
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

  return (
    <div className={styles.shell}>
      <DashboardSidebar active={section} />
      <main className={styles.main}>
        <header className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>{meta.title}</h1>
            <p className={styles.pageDescription}>{meta.description}</p>
          </div>

          <div className={styles.headerTools}>
            {section !== 'integrations' ? <button className={styles.button} onClick={exportSectionCsv}>
              <Download size={16} />
              Export
            </button> : null}
            {meta.createItems.length > 0 ? <div className={styles.menuWrap}>
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
                        <button key={item.label} type="button" disabled>
                          <Icon size={16} />
                          {item.label}
                        </button>
                      )
                    )
                  })}
                </div>
              ) : null}
            </div> : null}
          </div>
        </header>

        {renderSection(section, {
          initialLeads,
          initialVideos,
          initialEmails,
          recentEmailSends,
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
      return <EmailsSection initialEmails={props.initialEmails} recentEmailSends={props.recentEmailSends} metrics={props.resolvedEmailMetrics} composerData={props.emailComposerData} setupConfig={props.setupConfig} />
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

function VideosSection({ initialVideos = [], metrics = [] }: { initialVideos?: VideoRecord[]; metrics?: MetricItem[]; setupConfig?: CrmSetupConfig }) {
  const [videos, setVideos] = useState(initialVideos)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(initialVideos[0]?.id || '')
  const [showStageMenu, setShowStageMenu] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showOwnerMenu, setShowOwnerMenu] = useState(false)
  const [showChannelMenu, setShowChannelMenu] = useState(false)
  const [stage, setStage] = useState('All stages')
  const [status, setStatus] = useState('All statuses')
  const [owner, setOwner] = useState('All owners')
  const [channel, setChannel] = useState('All channels')
  const [activeTab, setActiveTab] = useState('Library')
  const [deleteError, setDeleteError] = useState('')
  const [isDeleting, startDeleting] = useTransition()
  const videoTabs = [
    { label: 'Library', count: videos.length },
    { label: 'Ready', count: videos.filter((video) => video.hasMedia).length },
    { label: 'Drafts', count: videos.filter((video) => !video.hasMedia).length },
    { label: 'Personalised', count: videos.filter((video) => video.leadId).length },
    { label: 'Shared', count: videos.filter((video) => !video.leadId).length },
  ]
  const statuses = useMemo(() => ['All statuses', ...Array.from(new Set(videos.map((video) => video.status)))], [videos])
  const owners = useMemo(() => ['All owners', ...Array.from(new Set(videos.map((video) => video.owner)))], [videos])
  const channels = useMemo(() => ['All channels', ...Array.from(new Set(videos.map((video) => video.channel)))], [videos])

  function clearVideoFilters() {
    setQuery('')
    setStage('All stages')
    setStatus('All statuses')
    setOwner('All owners')
    setChannel('All channels')
  }

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return videos.filter((video) => {
      const matchesQuery = normalized
        ? `${video.title} ${video.company} ${video.owner} ${video.status}`.toLowerCase().includes(normalized)
        : true
      const matchesTab = activeTab === 'Library'
        || (activeTab === 'Ready' && video.hasMedia)
        || (activeTab === 'Drafts' && !video.hasMedia)
        || (activeTab === 'Personalised' && Boolean(video.leadId))
        || (activeTab === 'Shared' && !video.leadId)
      const matchesStage = stage === 'All stages' || video.funnelStage === stage
      const matchesStatus = status === 'All statuses' || video.status === status
      const matchesOwner = owner === 'All owners' || video.owner === owner
      const matchesChannel = channel === 'All channels' || video.channel === channel
      return matchesQuery && matchesTab && matchesStage && matchesStatus && matchesOwner && matchesChannel
    })
  }, [query, activeTab, stage, status, owner, channel, videos])
  const selectedVideo = videos.find((video) => video.id === selectedId) ?? filtered[0] ?? null

  useEffect(() => {
    if (selectedVideo && !filtered.some((video) => video.id === selectedVideo.id)) setSelectedId(filtered[0]?.id || '')
  }, [filtered, selectedVideo])

  function removeSelectedVideo() {
    if (!selectedVideo || !window.confirm(`Delete “${selectedVideo.title}”? This also removes the stored video file and cannot be undone.`)) return
    setDeleteError('')
    startDeleting(async () => {
      const result = await deleteVideoAsset(selectedVideo.id)
      if ('error' in result && result.error) {
        setDeleteError(String(result.error))
        return
      }
      setVideos((current) => current.filter((video) => video.id !== selectedVideo.id))
      setSelectedId('')
    })
  }

  return (
    <>
      <MetricGrid items={metrics} />

      <div className={styles.panel} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <strong>Video studio</strong>
          <div className={styles.subtle}>Record or upload real media, edit the campaign presentation, then save and share it.</div>
        </div>
        <div className={styles.detailActions}>
          <Link className={styles.button} href="/dashboard/videos/upload" data-dashboard-native="true"><Upload size={15} /> Upload video</Link>
          <Link className={styles.buttonPrimary} href="/dashboard/videos/editor" data-dashboard-native="true"><WandSparkles size={15} /> New project</Link>
        </div>
      </div>

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
          {filtered.length === 0 ? (
            <div style={{ padding: '44px 24px', textAlign: 'center', color: 'var(--muted)' }}>
              {videos.length ? 'No videos match the current filters.' : 'No videos yet. Upload media or create your first project.'}
            </div>
          ) : null}
        </div>

        <div className={styles.rightRail}>
          <RightPanel title="Selected video">
            {selectedVideo ? (
              <div className={styles.list}>
                <div><strong>{selectedVideo.title}</strong><div className={styles.subtle}>{selectedVideo.company}</div></div>
                <div className={styles.listRow}><span>Status</span><span className={cx(styles.pill, statusPill(selectedVideo.status))}>{selectedVideo.status}</span></div>
                <div className={styles.listRow}><span>Created</span><strong>{new Date(selectedVideo.createdAt).toLocaleDateString('en-GB')}</strong></div>
                <div className={styles.listRow}><span>Views</span><strong>{selectedVideo.viewCount}</strong></div>
                <div className={styles.listRow}><span>Duration</span><strong>{selectedVideo.duration}</strong></div>
                <div className={styles.detailActions}>
                  <Link className={styles.buttonPrimary} href={`/dashboard/videos/editor?asset=${selectedVideo.id}`} data-dashboard-native="true">Edit</Link>
                  {selectedVideo.slug ? <a className={styles.button} href={`/v/${selectedVideo.slug}`} target="_blank" rel="noreferrer" data-dashboard-native="true"><ExternalLink size={14} /> Open</a> : null}
                  <button className={styles.buttonGhost} onClick={removeSelectedVideo} disabled={isDeleting} data-dashboard-native="true"><Trash2 size={14} /> {isDeleting ? 'Deleting...' : 'Delete'}</button>
                </div>
                {deleteError ? <div style={{ color: '#f87171', fontSize: 13 }}>{deleteError}</div> : null}
              </div>
            ) : <div className={styles.subtle}>Choose a video to inspect it.</div>}
          </RightPanel>
        </div>
      </div>
    </>
  )
}

function EmailsSection({
  initialEmails = [],
  recentEmailSends = [],
  metrics = [],
  composerData = { leads: [], videos: [] },
  setupConfig,
}: {
  initialEmails?: EmailRecord[]
  recentEmailSends?: EmailSendRecord[]
  metrics?: MetricItem[]
  composerData?: { leads: EmailComposerLead[]; videos: EmailComposerVideo[] }
  setupConfig?: CrmSetupConfig
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(initialEmails[0]?.id || '')
  const [stage, setStage] = useState('All stages')
  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailRecord | undefined>()
  const [deleteConfirmationId, setDeleteConfirmationId] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [feedback, setFeedback] = useState('')

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
  const stages = useMemo(() => ['All stages', ...Array.from(new Set(initialEmails.map((email) => email.stage)))], [initialEmails])

  function openNewTemplate() {
    setEditingTemplate(undefined)
    setIsTemplateEditorOpen(true)
  }

  function openEditTemplate() {
    if (!selectedEmail) return
    setEditingTemplate(selectedEmail)
    setIsTemplateEditorOpen(true)
  }

  async function removeTemplate() {
    if (!selectedEmail) return
    if (deleteConfirmationId !== selectedEmail.id) {
      setDeleteConfirmationId(selectedEmail.id)
      setFeedback('Select “Confirm delete” to permanently remove this template. Sent email records will be kept.')
      return
    }
    setIsDeleting(true)
    const result = await deleteEmailTemplate(selectedEmail.id)
    setIsDeleting(false)
    if ('error' in result && result.error) {
      setFeedback(String(result.error))
      return
    }
    setDeleteConfirmationId('')
    setSelectedId('')
    setFeedback('Template deleted. Sent email records were kept for reporting.')
    router.refresh()
  }

  return (
    <>
      <section className={styles.workspaceIntro}>
        <div>
          <h2>Email workspace</h2>
          <p>Create reusable templates, send personalised messages, and review delivery activity recorded by the Online2Day API.</p>
        </div>
        <div className={styles.workspaceActions}>
          <button className={styles.button} onClick={openNewTemplate} data-dashboard-native="true"><Plus size={16} /> New template</button>
        </div>
      </section>
      <MetricGrid items={metrics} />
      <MailboxWorkspace leads={composerData.leads} setupConfig={setupConfig} />
      <div className={styles.emailWorkspaceGrid}>
        <div className={cx(styles.panel, styles.tablePanel)}>
          <div className={styles.panelHeaderPadded}>
            <div>
              <h3>Templates</h3>
              <p>{initialEmails.length} reusable template{initialEmails.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          <div className={styles.toolbar}>
            <label className={styles.smallSearch}>
              <Search size={14} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search templates..." aria-label="Search email templates" />
            </label>
            <label className={styles.compactSelectLabel}>
              <span>Stage</span>
              <select value={stage} onChange={(event) => setStage(event.target.value)} aria-label="Filter templates by stage">
                {stages.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>
          {filtered.length ? <EmailTable rows={filtered} selectedId={selectedId} onSelect={setSelectedId} /> : (
            <div className={styles.emptyWorkspace}>
              <Mail size={28} />
              <strong>{initialEmails.length ? 'No templates match these filters' : 'Create your first email template'}</strong>
              <p>{initialEmails.length ? 'Change the search or stage filter.' : 'Save a subject and message once, then personalise it for each lead.'}</p>
              {!initialEmails.length ? <button className={styles.buttonPrimary} onClick={openNewTemplate}><Plus size={16} /> New template</button> : null}
            </div>
          )}
        </div>
        <aside className={styles.recentSendsPanel}>
          <div className={styles.panelHeaderPadded}>
            <div>
              <h3>Recent sends</h3>
              <p>Latest API-recorded email activity</p>
            </div>
          </div>
          <div className={styles.recentSendsList}>
            {recentEmailSends.length ? recentEmailSends.slice(0, 10).map((send) => (
              <article key={send.id} className={styles.recentSendCard}>
                <div className={styles.recentSendHead}>
                  <strong>{send.recipientName}</strong>
                  <span className={cx(styles.deliveryStatus, styles[`delivery${send.status.replace(/\s+/g, '')}` as keyof typeof styles])}>{send.status}</span>
                </div>
                <p>{send.subject}</p>
                <div><span>{send.templateName}</span><time dateTime={send.sentAt}>{relativeDisplayTime(send.sentAt)}</time></div>
              </article>
            )) : (
              <div className={styles.emptyWorkspaceCompact}>
                <Send size={24} />
                <strong>No emails sent yet</strong>
                <p>Sent messages will appear here with their latest delivery state.</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {selectedEmail && (
        <section className={styles.templateDetailCard}>
          <div className={styles.templateDetailMain}>
            <div className={styles.logoMark}><Mail size={14} /></div>
            <div>
              <strong>{selectedEmail.template}</strong>
              <div className={styles.subtle}>{selectedEmail.subject}</div>
            </div>
          </div>
          <div className={styles.templateDetailMeta}>
            <span><small>Audience</small><strong>{selectedEmail.audience}</strong></span>
            <span><small>Stage</small><strong>{selectedEmail.stage}</strong></span>
            <span><small>Last edited</small><strong>{selectedEmail.lastEdited}</strong></span>
          </div>
          <div className={styles.templateBodyPreview}>
            <small>Message preview</small>
            <p>{selectedEmail.body}</p>
          </div>
          <div className={styles.templateActions}>
            <button className={styles.button} onClick={openEditTemplate}><PenSquare size={15} /> Edit</button>
            <button className={styles.buttonGhost} onClick={removeTemplate} disabled={isDeleting}>
              <Trash2 size={15} /> {isDeleting ? 'Deleting…' : deleteConfirmationId === selectedEmail.id ? 'Confirm delete' : 'Delete'}
            </button>
            {deleteConfirmationId === selectedEmail.id ? <button className={styles.buttonGhost} onClick={() => { setDeleteConfirmationId(''); setFeedback('') }}>Cancel</button> : null}
          </div>
        </section>
      )}
      {feedback ? <div className={styles.inlineFeedback} role="status">{feedback}</div> : null}
      {isTemplateEditorOpen ? (
        <EmailTemplateEditor
          template={editingTemplate}
          onClose={() => setIsTemplateEditorOpen(false)}
          onSaved={(message) => {
            setIsTemplateEditorOpen(false)
            setFeedback(message)
            router.refresh()
          }}
        />
      ) : null}
    </>
  )
}

function relativeDisplayTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatDashboardDateTime(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  })
}

function EmailTemplateEditor({
  template,
  onClose,
  onSaved,
}: {
  template?: EmailRecord
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [name, setName] = useState(template?.template || '')
  const [subject, setSubject] = useState(template?.subject || '')
  const [body, setBody] = useState(template?.body || '')
  const [category, setCategory] = useState(template?.category || 'Outreach')
  const [audience, setAudience] = useState(template?.audience || 'All leads')
  const [stage, setStage] = useState(template?.stage || 'Outreach')
  const [ctaLabel, setCtaLabel] = useState(template?.cta || 'Reply now')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  async function handleSave() {
    setSaving(true)
    setError('')
    const input = { name, subject, body, category, audience, stage, ctaLabel }
    const result = template ? await updateEmailTemplate(template.id, input) : await createEmailTemplate(input)
    setSaving(false)
    if ('error' in result && result.error) {
      setError(String(result.error))
      return
    }
    onSaved(template ? 'Template updated through the Online2Day API.' : 'Template created through the Online2Day API.')
  }

  return (
    <div className={styles.modalOverlay} onClick={(event) => event.target === event.currentTarget && onClose()}>
      <section className={styles.templateEditorModal} role="dialog" aria-modal="true" aria-labelledby="template-editor-title">
        <header className={styles.emailComposerHeader}>
          <div>
            <h2 id="template-editor-title">{template ? 'Edit email template' : 'New email template'}</h2>
            <p>Reusable copy is stored securely through the authenticated Online2Day API.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close template editor"><X size={18} /></button>
        </header>
        <div className={styles.templateEditorForm}>
          <label><span>Template name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={120} /></label>
          <div className={styles.formRowTwo}>
            <label><span>Audience</span><input value={audience} onChange={(event) => setAudience(event.target.value)} maxLength={120} /></label>
            <label><span>Stage</span><input value={stage} onChange={(event) => setStage(event.target.value)} maxLength={80} /></label>
          </div>
          <div className={styles.formRowTwo}>
            <label><span>Category</span><input value={category} onChange={(event) => setCategory(event.target.value)} maxLength={80} /></label>
            <label><span>CTA label</span><input value={ctaLabel} onChange={(event) => setCtaLabel(event.target.value)} maxLength={80} /></label>
          </div>
          <label><span>Subject</span><input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={180} /></label>
          <label><span>Message</span><textarea value={body} onChange={(event) => setBody(event.target.value)} rows={11} maxLength={20_000} /></label>
          {error ? <div className={styles.sendError} role="alert">{error}</div> : null}
          <div className={styles.emailComposerActions}>
            <button className={styles.button} onClick={onClose}>Cancel</button>
            <button className={styles.buttonPrimary} onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : template ? 'Save changes' : 'Create template'}</button>
          </div>
        </div>
      </section>
    </div>
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
  const [body, setBody] = useState(selectedTemplate?.body || `I wanted to send over a focused follow-up for ${firstLead?.company || 'your team'}.\n\nThe video below walks through the most relevant next step and gives you a simple way to ${setupConfig?.defaultCtaLabel?.toLowerCase() || 'book a call'} if it is useful.`)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !sending) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose, sending])

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
      templateId: selectedTemplate?.id,
      templateName: selectedTemplate?.template,
      videoAssetId: videoAssetId || undefined,
      ctaLabel: selectedTemplate?.cta || setupConfig?.defaultCtaLabel || 'Watch video',
    })
    setSending(false)
    if ('error' in result && result.error) {
      setStatus({ type: 'error', message: String(result.error) })
      return
    }
    setStatus({ type: 'success', message: 'warning' in result && result.warning ? String(result.warning) : 'Email sent and logged against the lead timeline.' })
  }

  return (
    <div className={styles.modalOverlay} onClick={(event) => event.target === event.currentTarget && onClose()}>
      <section className={styles.emailComposerModal} role="dialog" aria-modal="true" aria-label="Email composer">
        <header className={styles.emailComposerHeader}>
          <div>
            <h2>Send email</h2>
            <p>Resend delivers the message; the authenticated Online2Day API records the send and engagement.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close email composer"><X size={18} /></button>
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
              <button className={styles.buttonPrimary} onClick={handleSend} disabled={sending || !to.trim() || !subject.trim() || !body.trim()}>{sending ? 'Sending…' : 'Send email'}</button>
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
  const [messageFeedback, setMessageFeedback] = useState('')
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
      setMessageFeedback('')
      const result = await sendConversationReply(selectedConversation.id, text)
      if ('error' in result && result.error) {
        setMessageFeedback(String(result.error))
        return
      }
      setReplyText('')
      setMessageFeedback('Reply sent through the Online2Day API.')
      router.refresh()
    })
  }

  function selectConversation(conversation: ConversationRecord) {
    setSelectedId(conversation.id)
    setMessageFeedback('')
    if (conversation.unread) {
      startTransition(async () => {
        await markConversationRead(conversation.id)
        router.refresh()
      })
    }
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
              onClick={() => selectConversation(c)}
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
              {messageFeedback ? <div className={styles.inlineFeedback} role="status">{messageFeedback}</div> : null}
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
          <RightPanel title="Contact info">
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
  const router = useRouter()
  const [selectedId, setSelectedId] = useState(initialSiteRequests[0]?.id || '')
  const [query, setQuery] = useState('')
  const [stage, setStage] = useState('All stages')
  const [editStage, setEditStage] = useState(initialSiteRequests[0]?.stage || 'New')
  const [editPriority, setEditPriority] = useState<'Low' | 'Medium' | 'High'>(initialSiteRequests[0]?.priority || 'Medium')
  const [nextAction, setNextAction] = useState(initialSiteRequests[0]?.nextAction || '')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return initialSiteRequests.filter((req) => {
      const matchesQuery = normalized
        ? `${req.request} ${req.company} ${req.owner}`.toLowerCase().includes(normalized)
        : true
      return matchesQuery && (stage === 'All stages' || req.stage === stage)
    })
  }, [query, stage, initialSiteRequests])
  const selected = initialSiteRequests.find((item) => item.id === selectedId) ?? initialSiteRequests[0]
  const stages = ['New', 'Qualified', 'Discovery', 'Scoping', 'In Build', 'QA', 'Approval', 'Launched']

  useEffect(() => {
    if (!selected) return
    setEditStage(selected.stage)
    setEditPriority(selected.priority)
    setNextAction(selected.nextAction)
    setFeedback('')
  }, [selected?.id])

  async function saveRequest() {
    if (!selected) return
    setSaving(true)
    setFeedback('')
    const result = await updateSiteRequest(selected.id, { stage: editStage, priority: editPriority, nextAction })
    setSaving(false)
    if ('error' in result && result.error) {
      setFeedback(String(result.error))
      return
    }
    setFeedback('Request updated through the Online2Day API.')
    router.refresh()
  }

  return (
    <>
      <MetricGrid items={metrics} />
      <div className={styles.siteRequestWorkspace}>
        <div className={cx(styles.panel, styles.tablePanel)}>
          <div className={styles.panelHeaderPadded}>
            <div><h3>Requests</h3><p>{initialSiteRequests.length} live request{initialSiteRequests.length === 1 ? '' : 's'}</p></div>
          </div>
          <div className={styles.toolbar}>
            <label className={styles.smallSearch}>
              <Search size={14} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search requests..." aria-label="Search site requests" />
            </label>
            <label className={styles.compactSelectLabel}><span>Stage</span><select value={stage} onChange={(event) => setStage(event.target.value)}><option>All stages</option>{stages.map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>
          {filtered.length ? <SiteRequestTable rows={filtered} selectedId={selectedId} onSelect={setSelectedId} /> : <div className={styles.emptyWorkspace}><Inbox size={28} /><strong>No requests found</strong><p>Change the search or stage filter.</p></div>}
        </div>

        {selected && (
        <div className={cx(styles.detailCard, styles.siteRequestDetail)}>
          <div className={styles.panelHeader}>
            <div>
              <h3 className={styles.panelTitle}>{selected.request}</h3>
              <div className={styles.detailMeta}>
                <strong>{selected.company}</strong>
                <span className={styles.subtle}>{selected.type}</span>
                <span className={cx(styles.pill, stagePill(selected.stage))}>{selected.stage}</span>
                <span className={cx(styles.pill, priorityTone(selected.priority))}>{selected.priority}</span>
              </div>
            </div>
          </div>
          <dl className={styles.requestFacts}>
            <div><dt>Contact</dt><dd>{selected.owner}</dd></div>
            <div><dt>Email</dt><dd>{selected.contactEmail || 'Not provided'}</dd></div>
            <div><dt>Budget</dt><dd>{selected.value}</dd></div>
            <div><dt>Timeline</dt><dd>{selected.timelineWeeks ? `${selected.timelineWeeks} weeks` : 'Not provided'}</dd></div>
            <div><dt>Last activity</dt><dd>{selected.lastActivity}</dd></div>
          </dl>
          <div className={styles.requestDescription}>
            <small>Request summary</small>
            <p>{selected.description || 'No project description was supplied.'}</p>
          </div>
          <div className={styles.requestEditGrid}>
            <label><span>Stage</span><select value={editStage} onChange={(event) => setEditStage(event.target.value)}>{stages.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>Priority</span><select value={editPriority} onChange={(event) => setEditPriority(event.target.value as 'Low' | 'Medium' | 'High')}><option>Low</option><option>Medium</option><option>High</option></select></label>
            <label className={styles.requestNextAction}><span>Next action</span><input value={nextAction} onChange={(event) => setNextAction(event.target.value)} maxLength={240} /></label>
          </div>
          {feedback ? <div className={styles.inlineFeedback} role="status">{feedback}</div> : null}
          <div className={styles.detailActions}>
            <button className={styles.buttonPrimary} onClick={saveRequest} disabled={saving}>{saving ? 'Saving…' : 'Save request'}</button>
            {selected.leadId ? <Link className={styles.button} href={`/dashboard/leads/${selected.leadId}`}>Open lead</Link> : null}
            {selected.contactEmail ? <Link className={styles.button} href="/dashboard/emails"><Mail size={15} /> Email contact</Link> : null}
          </div>
        </div>
        )}
      </div>
    </>
  )
}

function IntegrationStatusBar({ status }: { status: IntegrationStatus }) {
  const latestCheck = status.healthChecks?.[0]
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
        {latestCheck ? `Last checked ${formatDashboardDateTime(latestCheck.checkedAt)}` : 'No health check recorded'}
      </span>
    </div>
  )
}

function IntegrationsSection({ integrationStatus = { connected: 0, suggested: 0, pending: 0 } }: { integrationStatus?: IntegrationStatus }) {
  const checks = integrationStatus.healthChecks || []
  const toneFor = (status: string) => status === 'healthy' ? styles.pillGreen : status === 'degraded' ? styles.pillYellow : status === 'down' ? styles.pillRed : styles.pill
  const latestFor = (provider: string) => checks.find((check) => check.provider.toLowerCase() === provider.toLowerCase())
  const statusFor = (provider: string) => latestFor(provider)?.status || 'unknown'
  return (
    <>
      <IntegrationStatusBar status={integrationStatus} />
      <div className={styles.integrationsGrid}>
        <IntegrationCard
          icon={<DatabaseIcon size={18} />}
          title="Supabase"
          description="Primary source of truth for leads, assets, events, chat, and request data."
          status={statusFor('Supabase')}
        />
        <IntegrationCard
          icon={<Mail size={18} />}
          title="Resend"
          description="Transactional delivery for personalised messages and engagement webhooks."
          status={statusFor('Resend')}
          action="Open email workspace"
          href="/dashboard/emails"
        />
        <IntegrationCard
          icon={<Users size={18} />}
          title="HubSpot"
          description="Contact sync and note creation for inbound submissions and sales touchpoints."
          status={statusFor('HubSpot')}
        />
        <IntegrationCard
          icon={<Video size={18} />}
          title="Video Library"
          description="Upload, categorize, and reuse personalised videos across campaigns and conversations."
          status="ready"
          action="Open library"
          href="/dashboard/videos"
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
                  <div className={styles.subtle}>{formatDashboardDateTime(check.checkedAt)}</div>
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
  const router = useRouter()

  function handleRowClick(e: ReactMouseEvent<HTMLTableRowElement>, lead: LeadRecord) {
    // checkbox click → select only, name link handles navigation
    if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
      onSelect(lead.id)
      return
    }
    router.push(`/dashboard/leads/${lead.id}`)
  }

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
              <tr
                key={lead.id}
                className={cx(styles.tableRow, selectedId === lead.id && styles.tableRowSelected)}
                onClick={(e) => handleRowClick(e, lead)}
                style={{ cursor: 'pointer' }}
              >
                <td onClick={(e) => { e.stopPropagation(); onSelect(lead.id) }}>
                  <input type="checkbox" checked={selectedId === lead.id} readOnly />
                </td>
                <td>
                  <div className={styles.identity}>
                    <div className={styles.avatar}>{initials(lead.contactName)}</div>
                    <div>
                      <strong className={styles.leadNameLink}>{lead.contactName}</strong>
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
        Showing {leads.length > 0 ? 1 : 0}–{leads.length} of {leads.length} leads
        <div className={styles.pagination}>
          <button>{'<'}</button>
          <button>1</button>
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
              <th>Status</th>
              <th>Media</th>
              <th>Views</th>
              <th>Created</th>
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
                <td><span className={cx(styles.pill, statusPill(video.status))}>{video.status}</span></td>
                <td>{video.hasMedia ? 'Source uploaded' : 'Project only'}</td>
                <td>{video.viewCount}</td>
                <td>{new Date(video.createdAt).toLocaleDateString('en-GB')}</td>
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
              <th>Open rate</th>
              <th>Click rate</th>
              <th>Reply rate</th>
              <th>CTA</th>
              <th>Last edited</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((email) => (
              <tr key={email.id} className={cx(selectedId === email.id && styles.tableRowSelected)} onClick={() => onSelect(email.id)}>
                <td><input type="radio" name="selected-email-template" aria-label={`Select ${email.template}`} checked={selectedId === email.id} readOnly /></td>
                <td><button className={styles.tableRowButton} onClick={() => onSelect(email.id)}>{email.template}</button></td>
                <td>{email.audience}</td>
                <td><span className={cx(styles.pill, stagePill(email.stage))}>{email.stage}</span></td>
                <td>{email.owner}</td>
                <td>{email.subject}</td>
                <td>{email.sent}</td>
                <td>{email.opens}%</td>
                <td>{email.clicks}%</td>
                <td>{email.replies}%</td>
                <td style={{ color: '#60a5fa' }}>{email.cta}</td>
                <td>{email.lastEdited}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.tableFooter}>
        Showing {rows.length} template{rows.length === 1 ? '' : 's'}
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
        Showing {rows.length} request{rows.length === 1 ? '' : 's'}
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
      </div>
    </div>
  )
}

function integrationStatusPill(status: string) {
  if (status === 'healthy' || status === 'ready') return styles.pillGreen
  if (status === 'degraded') return styles.pillYellow
  if (status === 'down') return styles.pillRed
  return styles.pillYellow
}

function IntegrationCard({
  icon,
  title,
  description,
  status,
  action,
  href,
}: {
  icon: ReactNode
  title: string
  description: string
  status: string
  action?: string
  href?: string
}) {
  return (
    <div className={styles.integrationCard}>
      <div className={styles.metricIcon}>{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className={styles.listRow}>
        <span className={cx(styles.pill, integrationStatusPill(status))}>{status}</span>
        {action && href ? <Link className={styles.button} href={href}>{action}</Link> : null}
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
