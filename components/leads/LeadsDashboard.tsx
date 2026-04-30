'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import styles from './LeadsDashboard.module.css'
import {
  leads,
  metrics,
  ownerPerformance,
  pipelineStages,
  processSteps,
  recentActivity,
  recommendations,
  sourcePerformance,
  tasks,
} from './leads-data'
import type { IconName, Lead, LeadStage, Metric, PipelineStage, TaskItem, ActivityItem } from './leads-types'

const stageOptions: LeadStage[] = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won']
const tabs = [
  { label: 'All leads', count: 248 },
  { label: 'High intent', count: 42 },
  { label: 'Follow-up due', count: 12 },
  { label: 'At risk', count: 8 },
  { label: 'Won', count: 32 },
]

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ')

export default function LeadsDashboard({ 
  initialLeads = leads, 
  initialMetrics = metrics,
  initialPipelineStages = pipelineStages,
  initialTasks = tasks,
  initialActivity = recentActivity,
  totalLeadCount,
}: { 
  initialLeads?: Lead[]
  initialMetrics?: Metric[]
  initialPipelineStages?: PipelineStage[]
  initialTasks?: TaskItem[]
  initialActivity?: ActivityItem[]
  totalLeadCount?: number
}) {
  const total = totalLeadCount ?? initialLeads.length
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState('All leads')
  const [selectedId, setSelectedId] = useState(initialLeads[0]?.id || '')
  const [selectedStage, setSelectedStage] = useState<'All stages' | LeadStage>('All stages')
  const [isStageOpen, setIsStageOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const filteredLeads = useMemo(() => {
    const normalised = query.trim().toLowerCase()
    return initialLeads.filter((lead) => {
      const matchesQuery = normalised
        ? `${lead.contactName} ${lead.role} ${lead.company} ${lead.stage} ${lead.owner}`.toLowerCase().includes(normalised)
        : true
      const matchesStage = selectedStage === 'All stages' || lead.stage === selectedStage
      const matchesTab =
        activeTab === 'All leads' ||
        (activeTab === 'High intent' && lead.score >= 80) ||
        (activeTab === 'Follow-up due' && ['Send follow-up', 'Nudge reply', 'Book meeting'].includes(lead.nextAction)) ||
        (activeTab === 'At risk' && lead.engagement < 50) ||
        (activeTab === 'Won' && lead.stage === 'Won')
      return matchesQuery && matchesStage && matchesTab
    })
  }, [query, selectedStage, activeTab, initialLeads])

  const selectedLead = initialLeads.find((lead) => lead.id === selectedId) ?? initialLeads[0]

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <div className={styles.titleRow}>
              <h1>Leads</h1>
              <Icon name="star" className={styles.titleStar} />
            </div>
            <p>Manage, prioritise and convert your outreach pipeline.</p>
          </div>
          <div className={styles.topControls}>
            <label className={styles.globalSearch}>
              <Icon name="search" />
              <input placeholder="Search leads, contacts, companies..." aria-label="Search leads" />
              <span>⌘ K</span>
            </label>
            <button className={styles.utilityButton}>
              <Icon name="calendar" /> May 11 – May 18, 2025
            </button>
            <button className={styles.utilityButton}>
              <Icon name="filter" /> Filters
            </button>
            <button className={styles.utilityButton}>
              <Icon name="export" /> Export
            </button>
            <div className={styles.createWrap}>
              <button className={styles.primaryButton} onClick={() => setIsCreateOpen((open) => !open)}>
                <Icon name="plus" /> Create / Add <Icon name="chevron" />
              </button>
              {isCreateOpen ? <CreateMenu /> : null}
            </div>
          </div>
        </header>

        <section className={styles.metricsGrid} aria-label="Lead performance metrics">
          {initialMetrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </section>

        <ProcessGuide />
        
        <section className={styles.dashboardGrid}>
          <div className={styles.primaryColumn}>
            <AnalyticsStrip stages={initialPipelineStages} total={total} />
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
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search leads..." />
                </label>
                <FilterButton label="Status" />
                <FilterButton label="Owner" />
                <FilterButton label="Source" />
                <div className={styles.dropdownWrap}>
                  <button className={cx(styles.filterButton, isStageOpen && styles.filterActive)} onClick={() => setIsStageOpen((open) => !open)}>
                    Stage <Icon name="chevron" />
                  </button>
                  {isStageOpen ? (
                    <StageDropdown selectedStage={selectedStage} onSelect={setSelectedStage} />
                  ) : null}
                </div>
                <FilterButton label="Score" />
                <FilterButton label="More filters" />
                <div className={styles.tableToolsRight}>
                  <button className={styles.filterButton}><Icon name="columns" /> Columns</button>
                  <button className={styles.filterButton}>Sort: Last activity <Icon name="chevron" /></button>
                </div>
              </div>

              <LeadTable leads={filteredLeads} selectedId={selectedId} onSelect={setSelectedId} />
            </section>
          </div>

          <RightRail tasks={initialTasks} activity={initialActivity} />
        </section>
      </main>
      <LeadCommandBar lead={selectedLead} />
    </div>
  )
}

function CreateMenu() {
  const items: Array<{ label: string; icon: IconName }> = [
    { label: 'Add lead', icon: 'users' },
    { label: 'Import contacts', icon: 'upload' },
    { label: 'Create task', icon: 'task' },
    { label: 'Assign owner', icon: 'owner' },
    { label: 'Create video', icon: 'video' },
    { label: 'Log activity', icon: 'clock' },
  ]

  return (
    <div className={styles.createMenu} role="menu">
      {items.map((item) => (
        <button key={item.label} role="menuitem">
          <Icon name={item.icon} />
          {item.label}
        </button>
      ))}
    </div>
  )
}

function MetricCard({ metric }: { metric: (typeof metrics)[number] }) {
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

function Sparkline({ values }: { values: number[] }) {
  const width = 140
  const height = 34
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

function ProcessGuide() {
  return (
    <section className={styles.processCard}>
      <div className={styles.processLeft}>
        <h2>Guide to Sale: Your lead conversion process</h2>
        <div className={styles.steps}>
          {processSteps.map((step, index) => {
            const isActive = index === 2
            return (
              <div key={step} className={styles.stepItem}>
                <div className={cx(styles.stepCircle, isActive && styles.stepActive)}>{index + 1}</div>
                <span>{step}</span>
              </div>
            )
          })}
        </div>
      </div>
      <button className={styles.nextActionCard}>
        <span><Icon name="star" /> Next best action</span>
        <strong>Follow up with 5 high-intent leads</strong>
        <Icon name="chevron" />
      </button>
    </section>
  )
}

function AnalyticsStrip({ stages, total }: { stages: PipelineStage[]; total: number }) {
  return (
    <section className={styles.analyticsGrid}>
      <article className={styles.analyticsCard}>
        <h3>Pipeline by stage</h3>
        <div className={styles.funnelRow}>
          <Funnel stages={stages} />
          <div className={styles.stageLegend}>
            {stages.map((stage) => (
              <div key={stage.label}>
                <i style={{ backgroundColor: stage.color }} />
                <span>{stage.label}</span>
                <strong>{stage.count} ({stage.percentage}%)</strong>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.analyticsFooter}>Total <strong>{total}</strong></div>
      </article>

      <article className={styles.analyticsCard}>
        <h3>Lead source performance</h3>
        <div className={styles.compactTable}>
          <div className={styles.compactHeader}><span>Source</span><span>Leads</span><span>Conv. rate</span><span>Value</span></div>
          {sourcePerformance.map((source) => (
            <div className={styles.compactRow} key={source.source}>
              <span>{source.source}</span>
              <strong>{source.leads}</strong>
              <span>{source.conversion}</span>
              <b>{source.value}</b>
              <em style={{ width: `${source.bar}%`, backgroundColor: source.color }} />
            </div>
          ))}
        </div>
        <a className={styles.panelLink} href="#">View full report →</a>
      </article>

      <article className={styles.analyticsCard}>
        <h3>Owner performance</h3>
        <div className={styles.ownerTable}>
          <div className={styles.ownerHeader}><span>Owner</span><span>Leads</span><span>Meetings</span><span>Won</span><span>Value</span></div>
          {ownerPerformance.map((owner) => (
            <div className={styles.ownerRow} key={owner.owner}>
              <span><Avatar initials={owner.avatar} size="sm" />{owner.owner}</span>
              <strong>{owner.leads}</strong>
              <span>{owner.meetings}</span>
              <span>{Math.max(2, Math.round(owner.meetings / 3))}</span>
              <b>{owner.revenue}</b>
            </div>
          ))}
        </div>
        <a className={styles.panelLink} href="#">View full leaderboard →</a>
      </article>
    </section>
  )
}

function Funnel({ stages }: { stages: PipelineStage[] }) {
  return (
    <svg className={styles.funnel} viewBox="0 0 130 110" aria-hidden="true">
      {stages.map((stage, index) => {
        const y = index * 15
        const inset = index * 9
        return (
          <polygon
            key={stage.label}
            points={`${10 + inset},${y + 4} ${120 - inset},${y + 4} ${111 - inset},${y + 17} ${19 + inset},${y + 17}`}
            fill={stage.color}
            opacity={0.94}
          />
        )
      })}
    </svg>
  )
}

function FilterButton({ label }: { label: string }) {
  return (
    <button className={styles.filterButton}>{label} <Icon name="chevron" /></button>
  )
}

function StageDropdown({ selectedStage, onSelect }: { selectedStage: 'All stages' | LeadStage; onSelect: (stage: 'All stages' | LeadStage) => void }) {
  return (
    <div className={styles.stageMenu} role="listbox">
      <button className={selectedStage === 'All stages' ? styles.optionActive : ''} onClick={() => onSelect('All stages')}>
        <span>All stages</span><Icon name="check" />
      </button>
      {stageOptions.map((stage) => (
        <button key={stage} className={selectedStage === stage ? styles.optionActive : ''} onClick={() => onSelect(stage)}>
          <span>{stage}</span>{selectedStage === stage ? <Icon name="check" /> : null}
        </button>
      ))}
    </div>
  )
}

function LeadTable({ leads, selectedId, onSelect }: { leads: Lead[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.leadsTable}>
        <thead>
          <tr>
            <th><input aria-label="Select all leads" type="checkbox" /></th>
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
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className={cx(selectedId === lead.id && styles.selectedRow)} onClick={() => onSelect(lead.id)}>
              <td><input checked={selectedId === lead.id} readOnly aria-label={`Select ${lead.contactName}`} type="checkbox" /></td>
              <td className={styles.leadCell}>
                <Avatar initials={lead.contactName.split(' ').map((n) => n[0]).join('')} />
                <div><strong>{lead.contactName}</strong><span>{lead.role}</span></div>
              </td>
              <td className={styles.companyCell}>
                <div className={cx(styles.companyLogo, lead.logoClass ? styles[lead.logoClass] : styles.logoDefault)}>
                  {lead.companyMark || lead.company.charAt(0).toUpperCase()}
                </div>
                <span>{lead.company}</span>
              </td>
              <td><Score value={lead.score} /></td>
              <td><StageBadge stage={lead.stage} /></td>
              <td className={styles.ownerCell}><Avatar initials={initialsForOwner(lead.owner)} size="sm" />{lead.owner}</td>
              <td><Icon name={lead.sourceIcon} className={styles.sourceIcon} /></td>
              <td>{lead.lastActivity}</td>
              <td className={styles.engagementCell}><span>{lead.engagement}%</span><ProgressBar value={lead.engagement} /></td>
              <td><strong>{lead.value}</strong></td>
              <td><a href="#">{lead.nextAction}</a></td>
              <td><Icon name="ellipsis" className={styles.rowMenu} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.tableFooter}>
        <span>Showing {leads.length} leads</span>
        <div className={styles.pagination}>
          <button>‹</button><button className={styles.pageActive}>1</button><button>2</button><button>3</button><button>4</button><button>5</button><span>…</span><button>25</button><button>›</button>
        </div>
        <button className={styles.rowsButton}>Rows per page <strong>10</strong><Icon name="chevron" /></button>
      </div>
    </div>
  )
}

function RightRail({ tasks: taskList, activity }: { tasks: TaskItem[]; activity: ActivityItem[] }) {
  const displayTasks = taskList.length > 0 ? taskList : tasks
  const displayActivity = activity.length > 0 ? activity : recentActivity
  return (
    <aside className={styles.rightRail}>
      <Panel title="Today's priorities" badge={displayTasks.length.toString()}>
        <div className={styles.taskList}>
          {displayTasks.map((task) => (
            <label key={task.label}>
              <input type="checkbox" checked={Boolean(task.checked)} readOnly />
              <span>{task.label}</span>
              <time>{task.time}</time>
            </label>
          ))}
        </div>
        <a className={styles.panelLink} href="#">View all tasks →</a>
      </Panel>

      <Panel title="AI recommendations">
        <div className={styles.recommendationList}>
          {recommendations.map((item) => (
            <div key={item.title} className={styles.recommendationItem}>
              <span className={cx(styles.recIcon, styles[`tone${item.tone}`])}><Icon name={item.icon} /></span>
              <div><strong>{item.title}</strong><p>{item.detail}</p></div>
              <button>{item.action}</button>
            </div>
          ))}
        </div>
        <a className={styles.panelLink} href="#">View all recommendations →</a>
      </Panel>

      <Panel title="Recent activity" action="All">
        <div className={styles.activityList}>
          {displayActivity.map((a) => (
            <div key={a.title}>
              <span />
              <p>{a.title}</p>
              <time>{a.time}</time>
            </div>
          ))}
        </div>
        <a className={styles.panelLink} href="#">View all activity →</a>
      </Panel>

      <Panel title="Goal progress" action="This month">
        <Goal label="Meetings booked" value="32 / 50" progress={64} />
        <Goal label="Revenue target" value="$128K / $200K" progress={64} />
        <a className={styles.panelLink} href="#">View goals →</a>
      </Panel>
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

function LeadCommandBar({ lead }: { lead: Lead }) {
  return (
    <section className={styles.commandBar}>
      <div className={cx(styles.commandLogo, lead.logoClass ? styles[lead.logoClass] : styles.logoDefault)}>{lead.companyMark}</div>
      <div className={styles.commandTitle}>
        <div><h2>{lead.company}</h2><StageBadge stage={lead.stage} /></div>
        <p>{lead.contactName} • {lead.role}</p>
        <div className={styles.contactActions}>
          <button><Icon name="mail" /></button>
          <button><Icon name="phone" /></button>
          <button><Icon name="linkedin" /></button>
          <button><Icon name="globe" /></button>
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
        <button 
          className={styles.primaryAction} 
          onClick={() => window.location.href = `/dashboard/leads/${lead.id}`}
        >
          <Icon name="external" />Open lead
        </button>
        <button><Icon name="mail" />Send email</button>
        <button><Icon name="video" />Create video</button>
        <button><Icon name="calendar" />Book call</button>
        <button className={styles.iconButton}><Icon name="ellipsis" /></button>
      </div>
    </section>
  )
}

function Goal({ label, value, progress }: { label: string; value: string; progress: number }) {
  return (
    <div className={styles.goalRow}>
      <div><span>{label}</span><strong>{value}</strong></div>
      <ProgressBar value={progress} />
    </div>
  )
}

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
  return owner.split(' ').map((part) => part[0]).join('').replace('.', '')
}

function Icon({ name, className }: { name: IconName; className?: string }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className }
  const paths: Record<IconName, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 1-4-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    video: <><path d="M15 10l4.55-2.28A1 1 0 0 1 21 8.62v6.76a1 1 0 0 1-1.45.9L15 14" /><rect x="3" y="6" width="12" height="12" rx="2" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
    message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /></>,
    request: <><path d="M14 3l7 7-7 7" /><path d="M21 10H3" /><path d="M3 10l5-5" /><path d="M3 10l5 5" /></>,
    integrations: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 17h7" /><path d="M17.5 14v7" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></>,
    filter: <><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></>,
    export: <><path d="M12 3v12" /><path d="M7 8l5-5 5 5" /><path d="M5 21h14" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
    dollar: <><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" /></>,
    trend: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
    diamond: <><path d="M12 2l8 8-8 12L4 10z" /></>,
    star: <><path d="M12 2l2.8 6 6.5.8-4.8 4.5 1.2 6.4L12 16.5l-6.3 3.7 1.2-6.4-4.8-4.5 6.5-.8z" /></>,
    task: <><path d="M9 11l2 2 4-4" /><rect x="4" y="3" width="16" height="18" rx="2" /></>,
    upload: <><path d="M12 15V3" /><path d="M7 8l5-5 5 5" /><path d="M5 21h14" /></>,
    owner: <><circle cx="12" cy="7" r="4" /><path d="M5.5 21a6.5 6.5 0 0 1 13 0" /></>,
    globe: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15 15 0 0 1 0 20" /><path d="M12 2a15 15 0 0 0 0 20" /></>,
    phone: <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07A19.5 19.5 0 0 1 5.15 12 19.8 19.8 0 0 1 2.08 3.37 2 2 0 0 1-.45 2.11L8 8.85a16 16 0 0 0 7.15 7.15l1.19-1.19a2 2 0 0 1 2.11-.45c.85.26 1.73.46 2.63.58A2 2 0 0 1 22 16.92z" /></>,
    linkedin: <><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></>,
    ellipsis: <><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>,
    chevron: <><path d="M9 18l6-6-6-6" /></>,
    external: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14L21 3" /></>,
    sparkle: <><path d="M12 2l1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6z" /><path d="M19 17l.7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7z" /></>,
    check: <><path d="M20 6L9 17l-5-5" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
    columns: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /><path d="M15 4v16" /></>,
    crown: <><path d="M3 8l4 4 5-8 5 8 4-4v11H3z" /><path d="M3 19h18" /></>,
  }

  return <svg {...common}>{paths[name]}</svg>
}
