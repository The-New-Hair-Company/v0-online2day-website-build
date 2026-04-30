import { createClient } from '@/lib/supabase/server'
import LeadsDashboard from '@/components/leads/LeadsDashboard'
import type { Lead, Metric, LeadStage, LeadSource, PipelineStage, TaskItem, ActivityItem } from '@/components/leads/leads-types'
import type { Tables } from '@/types/supabase'
import { formatDistanceToNow } from 'date-fns'

export const metadata = {
  title: 'Leads | Online2Day CRM Dashboard',
  description: 'Enterprise-grade lead command centre for Online2Day CRM.',
}

type DbLead = Tables<'leads'> & {
  owner: Pick<Tables<'user_profiles'>, 'email'> | Pick<Tables<'user_profiles'>, 'email'>[] | null
}

function mapStage(status: string | null): LeadStage {
  switch (status) {
    case 'Won':           return 'Won'
    case 'Contacted':     return 'Contacted'
    case 'Qualified':     return 'Qualified'
    case 'Proposal Sent': return 'Proposal Sent'
    case 'Negotiation':   return 'Negotiation'
    default:              return 'New'
  }
}

function mapSource(source: string | null): LeadSource {
  switch (source) {
    case 'Ads':           return 'Ads'
    case 'Referral':      return 'Referral'
    case 'Cold outreach': return 'Cold outreach'
    case 'Organic':       return 'Organic'
    default:              return 'Website'
  }
}

function mapDbLeadToUiLead(lead: DbLead): Lead {
  const source = mapSource(lead.source)
  const stage  = mapStage(lead.status)

  const ownerObj    = Array.isArray(lead.owner) ? lead.owner[0] : lead.owner
  const ownerEmail  = ownerObj?.email ?? null
  const ownerLabel  = ownerEmail ? ownerEmail.split('@')[0] : 'Unassigned'

  const dealValue = lead.value ? `$${Number(lead.value).toLocaleString()}` : '$0'

  return {
    id:           lead.id,
    contactName:  lead.name,
    role:         lead.role ?? lead.email ?? '',
    company:      lead.company ?? 'Private',
    companyMark:  (lead.company ?? lead.name).charAt(0).toUpperCase(),
    logoClass:    '',
    score:        lead.score ?? 0,
    stage,
    owner:        ownerLabel,
    source,
    sourceIcon:   source === 'Website' ? 'globe' : source === 'Ads' ? 'sparkle' : 'users',
    lastActivity: formatDistanceToNow(new Date(lead.updated_at ?? lead.created_at)) + ' ago',
    engagement:   lead.engagement ?? 0,
    value:        dealValue,
    nextAction:   lead.next_action ?? (lead.status === 'New' ? 'Contact lead' : 'Follow up'),
  }
}

export default async function LeadsPage() {
  const supabase = await createClient()

  // --- 1. Fetch leads with joined owner ---
  const { data: dbLeads, error } = await supabase
    .from('leads')
    .select(`
      id, name, company, email, phone, source, status, website,
      assigned_to, notes, follow_up_date, created_at, updated_at,
      role, score, engagement, value, next_action,
      linkedin_url, lost_reason, last_contacted_at, closed_at,
      owner:user_profiles!leads_assigned_to_fkey(email)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[LeadsPage] Supabase error:', error.message)
    return (
      <div className="p-8 text-foreground">
        <p className="text-destructive font-medium">Error loading leads</p>
        <p className="text-muted-foreground text-sm mt-1">{error.message}</p>
      </div>
    )
  }

  const mappedLeads: Lead[] = (dbLeads as unknown as DbLead[]).map(mapDbLeadToUiLead)

  // --- 2. Compute real KPI metrics ---
  const now     = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const total     = dbLeads.length
  const newCount  = dbLeads.filter(l => new Date(l.created_at) > weekAgo).length
  const qualCount = dbLeads.filter(l => l.status === 'Qualified').length
  const wonCount  = dbLeads.filter(l => l.status === 'Won').length
  const highIntent = dbLeads.filter(l => (l.score ?? 0) >= 80).length
  const pipelineVal = dbLeads.reduce((sum, l) => sum + Number(l.value ?? 0), 0)

  const realMetrics: Metric[] = [
    { label: 'Total leads',      value: total.toString(),                delta: `${newCount} new this week`,   icon: 'users',    sparkline: [10,15,12,18,20,18,total] },
    { label: 'New this week',    value: newCount.toString(),             delta: 'vs last 7 days',               icon: 'calendar', sparkline: [2,5,3,8,4,6,newCount] },
    { label: 'Qualified leads',  value: qualCount.toString(),            delta: 'leads ready to pitch',         icon: 'diamond',  sparkline: [1,2,1,3,2,4,qualCount] },
    { label: 'High-intent',      value: highIntent.toString(),           delta: 'score ≥ 80',                   icon: 'trend',    sparkline: [0,1,2,1,3,2,highIntent] },
    { label: 'Meetings booked',  value: wonCount.toString(),             delta: 'closed this month',            icon: 'calendar', sparkline: [0,1,0,1,2,1,wonCount] },
    { label: 'Avg engagement',   value: total ? `${Math.round(dbLeads.reduce((s,l) => s + (l.engagement ?? 0), 0) / total)}%` : '0%', delta: 'avg engagement score', icon: 'sparkle', sparkline: [20,30,25,40,35,45,50] },
    { label: 'Pipeline value',   value: pipelineVal >= 1000 ? `$${(pipelineVal / 1000).toFixed(0)}K` : `$${pipelineVal}`, delta: 'total deal value', icon: 'dollar', sparkline: [36,38,40,42,44,47,49] },
    { label: 'Won',              value: wonCount.toString(),             delta: 'deals closed',                 icon: 'star',     sparkline: [0,0,1,1,2,2,wonCount] },
  ]

  // --- 3. Build real pipeline stages from DB ---
  const stageColors: Record<string, string> = {
    'New':           '#2f6bff',
    'Contacted':     '#19a9ff',
    'Qualified':     '#10d184',
    'Proposal Sent': '#8c5cff',
    'Negotiation':   '#ff9b2f',
    'Won':           '#f6c445',
  }
  const stageCounts = dbLeads.reduce<Record<string, number>>((acc, l) => {
    const s = l.status ?? 'New'
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})
  const realPipelineStages: PipelineStage[] = Object.entries(stageColors).map(([label, color]) => ({
    label:      label as LeadStage,
    count:      stageCounts[label] ?? 0,
    percentage: total > 0 ? Math.round(((stageCounts[label] ?? 0) / total) * 100) : 0,
    color,
  }))

  // --- 4. Fetch today's tasks from lead_tasks ---
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const { data: dbTasks } = await supabase
    .from('lead_tasks')
    .select('id, title, due_at, is_done')
    .gte('due_at', todayStart.toISOString())
    .lte('due_at', todayEnd.toISOString())
    .order('due_at', { ascending: true })
    .limit(5)

  const realTasks: TaskItem[] = (dbTasks ?? []).map(t => ({
    label:   t.title,
    time:    t.due_at ? new Date(t.due_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '',
    checked: t.is_done,
  }))

  // --- 5. Fetch recent activity from lead_events ---
  const { data: dbEvents } = await supabase
    .from('lead_events')
    .select('id, type, title, note, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  const realActivity: ActivityItem[] = (dbEvents ?? []).map(e => ({
    title: e.title ?? e.note ?? e.type,
    time:  new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
  }))

  return (
    <LeadsDashboard
      initialLeads={mappedLeads}
      initialMetrics={realMetrics}
      initialPipelineStages={realPipelineStages}
      initialTasks={realTasks}
      initialActivity={realActivity}
      totalLeadCount={total}
    />
  )
}
