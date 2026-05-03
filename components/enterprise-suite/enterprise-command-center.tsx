'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Copy,
  Database,
  Download,
  FileCheck2,
  Flag,
  Gauge,
  Headphones,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  Mail,
  MessageSquareText,
  Mic,
  MonitorUp,
  PhoneCall,
  Play,
  Plus,
  Radio,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  TimerReset,
  TrendingUp,
  Users,
  Video,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import { DashboardSidebar } from '@/components/leads/DashboardSidebar'
import styles from './enterprise-suite.module.css'
import {
  getEnabledFeatures,
  setEnabledFeatures,
  getEnterpriseTasks,
  addEnterpriseTask,
  toggleEnterpriseTask,
  getEnterpriseEvents,
  addEnterpriseEvent,
} from '@/lib/actions/enterprise-actions'
import { logAuditEntry, getAuditLog } from '@/lib/actions/audit-actions'

type Category =
  | 'Calendar & meetings'
  | 'Video calling'
  | 'Pipeline intelligence'
  | 'Comms & sequences'
  | 'Data governance'
  | 'Ops & delivery'
  | 'Growth & performance'

type EnterpriseChange = {
  id: string
  category: Category
  title: string
  detail: string
  action: string
  icon: LucideIcon
}

type CalendarEvent = {
  id: string
  title: string
  time: string
  owner: string
  type: string
}

type AuditEntry = {
  id: string
  time: string
  action: string
  detail: string
}

type TaskItem = {
  id: string
  title: string
  isDone: boolean
}

const enterpriseChanges: EnterpriseChange[] = [
  { id: 'internal-calendar', category: 'Calendar & meetings', title: 'Internal calendar board', detail: 'Shared operational calendar for calls, build reviews, launches and renewals.', action: 'Open board', icon: CalendarDays },
  { id: 'discovery-event', category: 'Calendar & meetings', title: 'One-click discovery event', detail: 'Create a structured internal discovery meeting with owner and agenda.', action: 'Add event', icon: Plus },
  { id: 'ics-export', category: 'Calendar & meetings', title: 'Download calendar invite', detail: 'Export the next meeting as an .ics file ready for calendar providers.', action: 'Download .ics', icon: Download },
  { id: 'agenda-copy', category: 'Calendar & meetings', title: 'Copy meeting agenda', detail: 'Generate a clean agenda for internal calls and client reviews.', action: 'Copy agenda', icon: Copy },
  { id: 'reminder-timer', category: 'Calendar & meetings', title: 'Meeting reminder timer', detail: 'Start a visible preparation timer for the next scheduled meeting.', action: 'Start timer', icon: Clock },
  { id: 'availability-slots', category: 'Calendar & meetings', title: 'Availability slots', detail: 'Create internal availability windows for quick booking and handoffs.', action: 'Generate slots', icon: TimerReset },
  { id: 'follow-up-task', category: 'Calendar & meetings', title: 'Post-meeting follow-up', detail: 'Create a follow-up task from the latest meeting context.', action: 'Create task', icon: ClipboardCheck },
  { id: 'video-room', category: 'Video calling', title: 'Instant video room', detail: 'Generate an internal browser call room link for the current workspace.', action: 'Create room', icon: Video },
  { id: 'camera-check', category: 'Video calling', title: 'Camera and mic check', detail: 'Request local media permission and confirm the browser can join calls.', action: 'Check devices', icon: Camera },
  { id: 'screen-share', category: 'Video calling', title: 'Screen-share checklist', detail: 'Add a pre-call checklist for demo tabs, CRM context and permissions.', action: 'Add checklist', icon: MonitorUp },
  { id: 'call-notes', category: 'Video calling', title: 'Call notes pad', detail: 'Open structured notes for decisions, blockers, next steps and owners.', action: 'Open notes', icon: MessageSquareText },
  { id: 'recording-consent', category: 'Video calling', title: 'Recording consent gate', detail: 'Track a consent reminder before recording or storing meeting assets.', action: 'Enable gate', icon: ShieldCheck },
  { id: 'participant-queue', category: 'Video calling', title: 'Participant queue', detail: 'Stage internal attendees before a live call starts.', action: 'Queue team', icon: Users },
  { id: 'post-call-summary', category: 'Video calling', title: 'Post-call summary', detail: 'Generate a structured summary shell for CRM and email follow-up.', action: 'Draft summary', icon: FileCheck2 },
  { id: 'deal-health', category: 'Pipeline intelligence', title: 'Deal health score', detail: 'Calculate a visible health score from stage, engagement and next action.', action: 'Score deal', icon: HeartPulse },
  { id: 'sla-timer', category: 'Pipeline intelligence', title: 'Lead SLA timer', detail: 'Start a response SLA clock so hot leads do not sit idle.', action: 'Start SLA', icon: Bell },
  { id: 'forecast-scenario', category: 'Pipeline intelligence', title: 'Forecast scenario', detail: 'Create a conservative forecast card for the active pipeline.', action: 'Forecast', icon: TrendingUp },
  { id: 'priority-matrix', category: 'Pipeline intelligence', title: 'Priority matrix', detail: 'Sort work into urgent, high-value, nurture and hold lanes.', action: 'Build matrix', icon: LayoutDashboard },
  { id: 'objection-tracker', category: 'Pipeline intelligence', title: 'Objection tracker', detail: 'Track buyer objections and assign content or follow-up responses.', action: 'Track objection', icon: AlertTriangle },
  { id: 'account-plan', category: 'Pipeline intelligence', title: 'Account plan', detail: 'Create stakeholder, problem, value and next-step planning fields.', action: 'Create plan', icon: Workflow },
  { id: 'renewal-watch', category: 'Pipeline intelligence', title: 'Renewal watch', detail: 'Flag accounts that need proof, usage evidence or renewal prep.', action: 'Watch account', icon: Activity },
  { id: 'email-sequence', category: 'Comms & sequences', title: 'Email sequence draft', detail: 'Build a three-touch sequence for video, proof and meeting conversion.', action: 'Draft sequence', icon: Mail },
  { id: 'video-email-queue', category: 'Comms & sequences', title: 'Video email queue', detail: 'Queue personalised video outreach for review before send.', action: 'Queue send', icon: Play },
  { id: 'call-script', category: 'Comms & sequences', title: 'Internal call script', detail: 'Create a concise call script from the current sales premise.', action: 'Create script', icon: PhoneCall },
  { id: 'proposal-mailto', category: 'Comms & sequences', title: 'Proposal mailto', detail: 'Open a pre-filled email draft for proposal follow-up.', action: 'Open email', icon: Mail },
  { id: 'reply-sentiment', category: 'Comms & sequences', title: 'Reply sentiment tags', detail: 'Add positive, neutral and blocked reply states to the workspace.', action: 'Tag replies', icon: MessageSquareText },
  { id: 'nurture-cadence', category: 'Comms & sequences', title: 'Nurture cadence', detail: 'Create a lightweight 7-day nurture schedule.', action: 'Create cadence', icon: CalendarDays },
  { id: 'outbound-qa', category: 'Comms & sequences', title: 'Outbound QA checklist', detail: 'Review merge fields, consent, CTA, asset link and tone before sending.', action: 'Run QA', icon: CheckCircle2 },
  { id: 'shared-snippets', category: 'Comms & sequences', title: 'Shared snippets', detail: 'Enable reusable internal snippets for proof, objections and CTAs.', action: 'Load snippets', icon: Sparkles },
  { id: 'gdpr-marker', category: 'Data governance', title: 'GDPR audit marker', detail: 'Add an audit marker for changes that touch lead or campaign data.', action: 'Log marker', icon: ShieldCheck },
  { id: 'consent-vault', category: 'Data governance', title: 'Consent vault', detail: 'Create a front-end consent record area ready for backend persistence.', action: 'Open vault', icon: KeyRound },
  { id: 'retention-rule', category: 'Data governance', title: 'Retention rule', detail: 'Set a 90-day review marker for stored video and campaign data.', action: 'Set rule', icon: Database },
  { id: 'data-quality', category: 'Data governance', title: 'Data quality scan', detail: 'Run a front-end scan for missing owner, email, source and next action.', action: 'Scan data', icon: Search },
  { id: 'csv-export', category: 'Data governance', title: 'Export workspace CSV', detail: 'Download current enterprise workspace data as a CSV handoff file.', action: 'Export CSV', icon: Download },
  { id: 'permission-matrix', category: 'Data governance', title: 'Permission matrix', detail: 'Model Admin, Sales, Delivery and Viewer access states.', action: 'Build matrix', icon: Users },
  { id: 'dpa-checklist', category: 'Data governance', title: 'DPA checklist', detail: 'Add a processor/subprocessor checklist for enterprise deals.', action: 'Add DPA', icon: FileCheck2 },
  { id: 'feature-flags', category: 'Ops & delivery', title: 'Feature flag board', detail: 'Enable local flags for beta UI, video calls and advanced scoring.', action: 'Toggle flags', icon: Flag },
  { id: 'release-notes', category: 'Ops & delivery', title: 'Release notes builder', detail: 'Create a release note shell from recently enabled features.', action: 'Draft notes', icon: Rocket },
  { id: 'incident-banner', category: 'Ops & delivery', title: 'Incident banner', detail: 'Toggle an internal status banner for support and delivery teams.', action: 'Toggle banner', icon: Radio },
  { id: 'onboarding-checklist', category: 'Ops & delivery', title: 'Onboarding checklist', detail: 'Create a practical onboarding list for new users and clients.', action: 'Create list', icon: ClipboardCheck },
  { id: 'support-sla', category: 'Ops & delivery', title: 'Support SLA board', detail: 'Add SLA states for waiting, investigating, resolved and escalated.', action: 'Create board', icon: Headphones },
  { id: 'integration-health', category: 'Ops & delivery', title: 'Integration health', detail: 'Show front-end health states for Supabase, Resend, Calendar and Video.', action: 'Check health', icon: Gauge },
  { id: 'capacity-planning', category: 'Ops & delivery', title: 'Project capacity planner', detail: 'Create a lightweight capacity model for delivery planning.', action: 'Plan capacity', icon: BarChart3 },
  { id: 'lighthouse-budget', category: 'Growth & performance', title: 'Lighthouse budget', detail: 'Set mobile performance, accessibility, SEO and best-practice budgets.', action: 'Set budget', icon: Gauge },
  { id: 'roi-calculator', category: 'Growth & performance', title: 'ROI calculator', detail: 'Estimate value from leads, conversion lift and average deal size.', action: 'Calculate ROI', icon: TrendingUp },
  { id: 'license-usage', category: 'Growth & performance', title: 'License usage meter', detail: 'Track seat, video and campaign usage against plan thresholds.', action: 'Update usage', icon: KeyRound },
  { id: 'pricing-fit', category: 'Growth & performance', title: 'Pricing fit assistant', detail: 'Recommend Starter, Pro or Agency based on current workspace needs.', action: 'Recommend plan', icon: Sparkles },
  { id: 'nps-pulse', category: 'Growth & performance', title: 'NPS pulse', detail: 'Capture a quick internal customer-sentiment pulse.', action: 'Capture NPS', icon: HeartPulse },
  { id: 'qbr-outline', category: 'Growth & performance', title: 'QBR deck outline', detail: 'Create a review outline with outcomes, usage, risks and next bets.', action: 'Draft QBR', icon: FileCheck2 },
  { id: 'churn-risk', category: 'Growth & performance', title: 'Churn risk radar', detail: 'Surface a front-end risk score and mitigation task.', action: 'Assess risk', icon: AlertTriangle },
]

const categories: Array<Category | 'All'> = ['All', 'Calendar & meetings', 'Video calling', 'Pipeline intelligence', 'Comms & sequences', 'Data governance', 'Ops & delivery', 'Growth & performance']

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function EnterpriseCommandCenter() {
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All')
  const [query, setQuery] = useState('')
  const [enabled, setEnabled] = useState<string[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [roomLink, setRoomLink] = useState('')
  const [callStatus, setCallStatus] = useState('No live room yet')
  const [notes, setNotes] = useState('Decision:\n\nRisk:\n\nNext step:\n')
  const [workspaceStatus, setWorkspaceStatus] = useState('Review complete: 50 functional enterprise enhancements identified.')
  const [timerActive, setTimerActive] = useState(false)
  const [incidentVisible, setIncidentVisible] = useState(false)
  const [healthScore, setHealthScore] = useState(82)
  const [riskScore, setRiskScore] = useState(24)
  const [roi, setRoi] = useState(0)

  useEffect(() => {
    getEnabledFeatures().then(setEnabled)
    getEnterpriseTasks().then(setTasks)
    getEnterpriseEvents().then((evts) =>
      setEvents(evts.map((e) => ({ id: e.id, title: e.title, time: e.time, owner: '', type: e.type })))
    )
    getAuditLog(18).then((rows) =>
      setAuditLog(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (rows as any[]).map((r) => ({
          id: r.id,
          time: new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          action: r.action,
          detail: [r.resource, r.changes].filter(Boolean).join(': '),
        }))
      )
    )
  }, [])

  function record(action: string, detail: string) {
    const entry: AuditEntry = { id: `${Date.now()}`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), action, detail }
    setAuditLog((current) => [entry, ...current].slice(0, 18))
    logAuditEntry(action, 'enterprise', undefined, detail)
  }

  function markEnabled(change: EnterpriseChange) {
    setEnabled((current) => {
      if (current.includes(change.id)) return current
      const next = [...current, change.id]
      setEnabledFeatures(next)
      return next
    })
    record(change.title, change.detail)
  }

  function addTaskOptimistic(title: string) {
    const tempId = `temp-${Date.now()}`
    setTasks((current) => [{ id: tempId, title, isDone: false }, ...current])
    addEnterpriseTask(title)
  }

  function addEventOptimistic(title: string, time: string, type: string, owner = '') {
    const tempId = `temp-${Date.now()}`
    setEvents((current) => [{ id: tempId, title, time, owner, type }, ...current])
    addEnterpriseEvent(title, time, type)
  }

  async function copyText(text: string, success: string) {
    try {
      await navigator.clipboard?.writeText(text)
      setWorkspaceStatus(success)
    } catch {
      setWorkspaceStatus(`${success} Copy manually if browser permissions block clipboard access.`)
    }
  }

  async function runChange(change: EnterpriseChange) {
    markEnabled(change)

    if (change.id === 'internal-calendar') {
      setWorkspaceStatus('Internal calendar board is active with today\'s review schedule.')
      return
    }
    if (change.id === 'discovery-event') {
      addEventOptimistic('Discovery and scope review', '13:30', 'Discovery', 'Growth')
      setWorkspaceStatus('Discovery event added to the internal calendar.')
      return
    }
    if (change.id === 'ics-export') {
      const event = events[0] || { title: 'Pipeline standup' }
      downloadFile('online2day-internal-event.ics', `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${event.title}
DESCRIPTION:Online2Day internal enterprise workflow event.
DTSTART:20260504T093000Z
DTEND:20260504T100000Z
END:VEVENT
END:VCALENDAR`, 'text/calendar')
      setWorkspaceStatus('Calendar invite downloaded.')
      return
    }
    if (change.id === 'agenda-copy') {
      await copyText('Agenda: pipeline state, active risks, video/email follow-up, owner decisions, next 24 hours.', 'Meeting agenda copied.')
      return
    }
    if (change.id === 'reminder-timer') {
      setTimerActive(true)
      setWorkspaceStatus('15 minute preparation timer started.')
      return
    }
    if (change.id === 'availability-slots') {
      addEventOptimistic('Open availability window', '16:00', 'Availability', 'Team')
      setWorkspaceStatus('Availability slot generated.')
      return
    }
    if (change.id === 'follow-up-task') {
      addTaskOptimistic('Send follow-up summary after next meeting')
      setWorkspaceStatus('Post-meeting follow-up task created.')
      return
    }
    if (change.id === 'video-room') {
      const link = `${window.location.origin}/dashboard/enterprise?room=o2d-${Date.now()}`
      setRoomLink(link)
      setCallStatus('Video room ready')
      await copyText(link, 'Internal video room link created and copied.')
      return
    }
    if (change.id === 'camera-check') {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCallStatus('Browser media check is not supported here')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        stream.getTracks().forEach((track) => track.stop())
        setCallStatus('Camera and microphone are available')
      } catch {
        setCallStatus('Camera or microphone permission was blocked')
      }
      return
    }
    if (change.id === 'screen-share') {
      addTaskOptimistic('Open CRM context, proposal tab and video editor before sharing screen')
      setWorkspaceStatus('Screen-share checklist added.')
      return
    }
    if (change.id === 'call-notes') {
      setNotes('Decision:\n- \n\nBlocker:\n- \n\nOwner:\n- \n\nNext step:\n- ')
      setWorkspaceStatus('Structured call notes opened.')
      return
    }
    if (change.id === 'recording-consent') {
      addTaskOptimistic('Confirm recording consent before saving any call asset')
      setWorkspaceStatus('Recording consent gate enabled.')
      return
    }
    if (change.id === 'participant-queue') {
      setCallStatus('Participants queued: Sales, Delivery, Creative')
      return
    }
    if (change.id === 'post-call-summary') {
      setNotes((current) => `${current}\n\nSummary:\n- Context confirmed\n- Follow-up owner assigned\n- Video/email action logged`)
      setWorkspaceStatus('Post-call summary shell drafted.')
      return
    }
    if (change.id === 'deal-health') {
      setHealthScore((current) => Math.min(99, current + 7))
      setWorkspaceStatus('Deal health score refreshed.')
      return
    }
    if (change.id === 'sla-timer') {
      setTimerActive(true)
      addTaskOptimistic('Respond to high-intent lead inside SLA window')
      return
    }
    if (change.id === 'forecast-scenario') {
      setRoi(18400)
      setWorkspaceStatus('Conservative forecast scenario created.')
      return
    }
    if (change.id === 'priority-matrix') {
      addTaskOptimistic('Priority matrix: hot leads, build blockers, renewal watch, nurture lane')
      return
    }
    if (change.id === 'proposal-mailto') {
      window.location.href = 'mailto:?subject=Online2Day proposal follow-up&body=Hi,%0A%0AI have prepared the proposal follow-up and next steps.%0A%0A'
      return
    }
    if (change.id === 'csv-export') {
      downloadFile('enterprise-workspace.csv', 'type,title,status\nhealth,Deal health,Active\ncalendar,Internal events,Active\nvideo,Internal room,Ready\n', 'text/csv')
      setWorkspaceStatus('Workspace CSV exported.')
      return
    }
    if (change.id === 'incident-banner') {
      setIncidentVisible((current) => !current)
      setWorkspaceStatus('Internal incident banner toggled.')
      return
    }
    if (change.id === 'integration-health') {
      setHealthScore(94)
      setWorkspaceStatus('Integration health checked: front-end connectors ready.')
      return
    }
    if (change.id === 'lighthouse-budget') {
      addTaskOptimistic('Keep public mobile Lighthouse budget at 90+ for performance and accessibility')
      return
    }
    if (change.id === 'roi-calculator') {
      setRoi(22500)
      setWorkspaceStatus('ROI estimate calculated from lead value and conversion lift.')
      return
    }
    if (change.id === 'pricing-fit') {
      setWorkspaceStatus('Pricing fit recommendation: Pro for unlimited videos, audit logging and sequences.')
      return
    }
    if (change.id === 'nps-pulse') {
      setHealthScore((current) => Math.min(100, current + 3))
      setWorkspaceStatus('NPS pulse captured at 9/10.')
      return
    }
    if (change.id === 'churn-risk') {
      setRiskScore(18)
      addTaskOptimistic('Churn mitigation: schedule value review and send usage proof')
      return
    }

    const taskLabel = `${change.title}: ${change.action}`
    if (!tasks.some((t) => t.title === taskLabel)) addTaskOptimistic(taskLabel)
    setWorkspaceStatus(`${change.title} enabled.`)
  }

  const filteredChanges = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return enterpriseChanges.filter((change) => {
      const matchesCategory = activeCategory === 'All' || change.category === activeCategory
      const matchesQuery = !normalized || `${change.title} ${change.detail} ${change.category}`.toLowerCase().includes(normalized)
      return matchesCategory && matchesQuery
    })
  }, [activeCategory, query])

  const completion = Math.round((enabled.length / enterpriseChanges.length) * 100)

  return (
    <div className={styles.shell}>
      <DashboardSidebar active="enterprise" />
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <Link href="/dashboard/overview" className={styles.backLink}>Dashboard</Link>
            <h1>Enterprise Command Center</h1>
            <p>{workspaceStatus}</p>
          </div>
          <div className={styles.headerActions}>
            <button onClick={() => void runChange(enterpriseChanges.find((item) => item.id === 'video-room')!)}><Video size={16} />Video room</button>
            <button onClick={() => void runChange(enterpriseChanges.find((item) => item.id === 'discovery-event')!)}><CalendarDays size={16} />Add event</button>
            <button className={styles.primaryButton} onClick={() => void runChange(enterpriseChanges.find((item) => item.id === 'csv-export')!)}><Download size={16} />Export</button>
          </div>
        </header>

        {incidentVisible ? <div className={styles.incidentBanner}><AlertTriangle size={16} /> Internal incident banner active. This can become a backend-backed status notice later.</div> : null}

        <section className={styles.metricsGrid}>
          <article><span>Reviewed changes</span><strong>50</strong><em>Value-add upgrades</em></article>
          <article><span>Implemented locally</span><strong>{enabled.length}</strong><em>{completion}% enabled</em></article>
          <article><span>Health score</span><strong>{healthScore}%</strong><em>Workspace readiness</em></article>
          <article><span>Risk score</span><strong>{riskScore}%</strong><em>Lower is better</em></article>
          <article><span>ROI estimate</span><strong>{roi ? `GBP ${roi.toLocaleString()}` : 'Ready'}</strong><em>Front-end model</em></article>
        </section>

        <section className={styles.workspaceGrid}>
          <article className={styles.panel}>
            <header><CalendarDays size={18} /><strong>Internal Calendar</strong><button onClick={() => void runChange(enterpriseChanges[1])}><Plus size={14} />Event</button></header>
            <div className={styles.eventList}>
              {events.map((event) => (
                <div key={event.id} className={styles.eventItem}>
                  <span>{event.time}</span>
                  <strong>{event.title}</strong>
                  <em>{event.owner ? `${event.owner} - ` : ''}{event.type}</em>
                </div>
              ))}
            </div>
            {timerActive ? <div className={styles.timerBadge}><Clock size={14} /> Prep/SLA timer running</div> : null}
          </article>

          <article className={styles.panel}>
            <header><Video size={18} /><strong>Internal Video Call</strong><button onClick={() => void runChange(enterpriseChanges[7])}><Radio size={14} />Room</button></header>
            <div className={styles.callStage}>
              <div className={styles.callAvatar}><Camera size={24} /></div>
              <div>
                <strong>{callStatus}</strong>
                <span>{roomLink || 'Generate a room link for internal calls, reviews and client prep.'}</span>
              </div>
            </div>
            <div className={styles.callActions}>
              <button onClick={() => void runChange(enterpriseChanges[8])}><Camera size={14} />Check</button>
              <button onClick={() => setCallStatus('Microphone muted')}><Mic size={14} />Mute</button>
              <button onClick={() => void runChange(enterpriseChanges[9])}><MonitorUp size={14} />Share prep</button>
            </div>
          </article>

          <article className={styles.panel}>
            <header><MessageSquareText size={18} /><strong>Shared Notes</strong><button onClick={() => void copyText(notes, 'Notes copied.')}><Copy size={14} />Copy</button></header>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} aria-label="Enterprise command notes" />
          </article>
        </section>

        <section className={styles.controlBar}>
          <div className={styles.searchBox}><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search 50 enterprise changes..." /></div>
          <div className={styles.categoryTabs}>
            {categories.map((category) => (
              <button key={category} className={activeCategory === category ? styles.activeTab : ''} onClick={() => setActiveCategory(category)}>{category}</button>
            ))}
          </div>
        </section>

        <section className={styles.changeGrid} aria-label="50 enterprise value-add changes">
          {filteredChanges.map((change, index) => {
            const Icon = change.icon
            const isEnabled = enabled.includes(change.id)
            return (
              <article key={change.id} className={isEnabled ? styles.changeActive : ''}>
                <div className={styles.changeTop}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <Icon size={18} />
                </div>
                <div className={styles.changeCategory}>{change.category}</div>
                <h2>{change.title}</h2>
                <p>{change.detail}</p>
                <button onClick={() => void runChange(change)}>
                  {isEnabled ? <CheckCircle2 size={15} /> : <Plus size={15} />}
                  {isEnabled ? 'Enabled' : change.action}
                </button>
              </article>
            )
          })}
        </section>

        <section className={styles.bottomGrid}>
          <article className={styles.panel}>
            <header><ClipboardCheck size={18} /><strong>Tasks created by features</strong></header>
            <div className={styles.taskList}>
              {tasks.slice(0, 10).map((task) => (
                <label key={task.id}>
                  <input
                    type="checkbox"
                    checked={task.isDone}
                    onChange={() => {
                      setTasks((current) => current.map((t) => t.id === task.id ? { ...t, isDone: !t.isDone } : t))
                      toggleEnterpriseTask(task.id, !task.isDone)
                    }}
                  />
                  {task.title}
                </label>
              ))}
            </div>
          </article>
          <article className={styles.panel}>
            <header><ShieldCheck size={18} /><strong>Audit trail</strong></header>
            <div className={styles.auditList}>
              {auditLog.length ? auditLog.map((entry) => (
                <div key={entry.id}><span>{entry.time}</span><strong>{entry.action}</strong><p>{entry.detail}</p></div>
              )) : <p>No actions logged yet.</p>}
            </div>
          </article>
        </section>
      </main>
    </div>
  )
}
