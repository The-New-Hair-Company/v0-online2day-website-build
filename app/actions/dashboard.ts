'use server'

import { createClient } from '@/lib/supabase/server'
import { isFoundingAdminEmail, normalizeEmail } from '@/lib/license'
import type {
  Lead, LeadStage, IconName, PipelineStage, LeadSourcePerformance,
  OwnerPerformance, Metric, TaskItem, ActivityItem, Recommendation
} from '@/components/leads/leads-types'
import type {
  LeadRecord, VideoRecord, EmailRecord, ConversationRecord, SiteRequestRecord
} from '@/components/crm-dashboard/types'

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function relativeTime(date: string | null): string {
  if (!date) return 'Never'
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function fmtDate(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── LEADS ────────────────────────────────────────────────────────────────────

export async function getLeads(): Promise<Lead[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('leads').select('*').order('created_at', { ascending: false })
  if (error || !data) return []

  const assignedIds = [...new Set(data.map(l => l.assigned_to).filter(Boolean))] as string[]
  const profilesMap: Record<string, string> = {}
  if (assignedIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles').select('user_id, full_name').in('user_id', assignedIds)
    profiles?.forEach(p => { profilesMap[p.user_id] = p.full_name || 'Unknown' })
  }

  return data.map((row): Lead => ({
    id: row.id,
    contactName: row.name || 'Unknown',
    role: row.role || 'Contact',
    company: row.company || 'Private',
    companyMark: (row.company || 'P').substring(0, 2).toUpperCase(),
    logoClass: 'logoGeneric',
    score: row.score || 0,
    stage: (row.status as LeadStage) || 'New',
    owner: profilesMap[row.assigned_to || ''] || 'Unassigned',
    source: (row.source as any) || 'Website',
    sourceIcon: 'globe',
    lastActivity: relativeTime(row.last_contacted_at),
    engagement: row.engagement || 0,
    value: row.value ? `$${Number(row.value).toLocaleString()}` : '$0',
    nextAction: row.next_action || 'Follow up',
    email: row.email || undefined,
  }))
}
export async function getLead(id: string): Promise<Lead | null> {
  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('leads').select('*').eq('id', id).single()
  if (error || !row) return null

  let ownerName = 'Unassigned'
  if (row.assigned_to) {
    const { data: profile } = await supabase
      .from('user_profiles').select('full_name').eq('user_id', row.assigned_to).single()
    if (profile) ownerName = profile.full_name || 'Unknown'
  }

  return {
    id: row.id,
    contactName: row.name || 'Unknown',
    role: row.role || 'Contact',
    company: row.company || 'Private',
    companyMark: (row.company || 'P').substring(0, 2).toUpperCase(),
    logoClass: 'logoGeneric',
    score: row.score || 0,
    stage: (row.status as LeadStage) || 'New',
    owner: ownerName,
    source: (row.source as any) || 'Website',
    sourceIcon: 'globe',
    lastActivity: relativeTime(row.last_contacted_at),
    engagement: row.engagement || 0,
    value: row.value ? `$${Number(row.value).toLocaleString()}` : '$0',
    nextAction: row.next_action || 'Follow up',
    email: row.email || undefined,
    phone: row.phone || undefined,
    notes: row.notes || undefined,
  }
}

export async function getLeadRecords(): Promise<LeadRecord[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('leads').select('*').order('created_at', { ascending: false })
  if (error || !data) return []

  return data.map((row): LeadRecord => ({
    id: row.id,
    contactName: row.name || 'Unknown',
    role: row.role || 'Contact',
    company: row.company || 'Private',
    companyMark: (row.company || 'P').substring(0, 2).toUpperCase(),
    score: row.score || 0,
    stage: (row.status as LeadStage) || 'New',
    owner: row.assigned_to || 'Unassigned',
    source: row.source || 'Website',
    lastActivity: relativeTime(row.last_contacted_at),
    engagement: row.engagement || 0,
    value: row.value ? `$${Number(row.value).toLocaleString()}` : '$0',
    nextAction: row.next_action || 'Follow up',
  }))
}

// ─── VIDEOS ──────────────────────────────────────────────────────────────────

export async function getVideos(): Promise<VideoRecord[]> {
  const supabase = await createClient()
  const [{ data, error }, { data: assets, error: assetError }] = await Promise.all([
    supabase
      .from('videos')
      .select('*, lead:lead_id(name, company, status)')
      .order('created_at', { ascending: false }),
    supabase
      .from('lead_assets')
      .select('*, lead:lead_id(name, company, status)')
      .eq('type', 'video')
      .order('created_at', { ascending: false }),
  ])

  const tableVideos = error || !data ? [] : (data as any[]).map((row): VideoRecord => ({
    id: row.id,
    title: row.title || 'Untitled Video',
    company: row.lead?.company || 'Prospect',
    duration: formatDuration(row.duration_seconds || 0),
    funnelStage: row.funnel_stage || 'Prospecting',
    owner: 'Sarah M.',
    channel: row.channel || 'Email',
    cta: row.cta_label || 'Watch Video',
    status: row.status || 'Draft',
    watchRate: row.watch_rate || 0,
    lastViewed: fmtDate(row.last_viewed_at),
    replies: row.reply_count || 0,
    nextAction: row.next_action || 'Follow up',
  }))

  const libraryVideos = assetError || !assets ? [] : (assets as any[]).map((row): VideoRecord => {
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
    const duration = Number(metadata.duration || metadata.recording?.duration || 0)
    const cta = typeof metadata.cta === 'object' && metadata.cta ? metadata.cta.label : undefined
    return {
      id: row.id,
      title: row.name || 'Recorded video',
      company: row.lead?.company || 'Prospect',
      duration: duration ? formatDuration(duration) : '00:00',
      funnelStage: row.lead?.status || 'Prospecting',
      owner: metadata.createdBy || 'Online2Day',
      channel: row.url ? 'Hosted page' : 'Editor project',
      cta: cta || 'Watch Video',
      status: row.url ? 'Ready' : 'Draft',
      watchRate: row.view_count || 0,
      lastViewed: fmtDate(row.created_at),
      replies: 0,
      nextAction: row.url ? 'Share video' : 'Finish edits',
    }
  })

  return [...libraryVideos, ...tableVideos]
}

// ─── EMAILS ──────────────────────────────────────────────────────────────────

export async function getEmails(): Promise<EmailRecord[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .order('created_at', { ascending: false })
  if (error || !data) return []

  return data.map((row: any): EmailRecord => ({
    id: row.id,
    template: row.name || 'Untitled Template',
    audience: row.audience || 'All Leads',
    stage: row.stage || 'Outreach',
    owner: 'Sarah M.',
    subject: row.subject || '(No Subject)',
    sent: row.sent_count || 0,
    opens: row.open_count || 0,
    replies: row.reply_count || 0,
    cta: row.cta_label || 'Reply now',
    lastEdited: relativeTime(row.updated_at),
    nextAction: 'Review performance',
  }))
}

export async function getEmailComposerData() {
  const supabase = await createClient()
  const [{ data: leads }, { data: videos }] = await Promise.all([
    supabase
      .from('leads')
      .select('id, name, company, email, status')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('lead_assets')
      .select('id, lead_id, name, slug, url, storage_path, created_at')
      .eq('type', 'video')
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  return {
    leads: (leads || []).map((lead: any) => ({
      id: lead.id,
      name: lead.name || 'Unknown',
      company: lead.company || 'Private',
      email: lead.email || '',
      status: lead.status || 'New',
    })),
    videos: (videos || []).map((video: any) => ({
      id: video.id,
      leadId: video.lead_id,
      name: video.name || 'Untitled video',
      slug: video.slug || '',
      createdAt: video.created_at || '',
    })),
  }
}

// ─── CONVERSATIONS / MESSAGES ────────────────────────────────────────────────

export async function getConversations(): Promise<ConversationRecord[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('conversations')
    .select('*, messages(id, content, is_read, created_at, sender_id, message_type)')
    .order('last_message_at', { ascending: false })
  if (error || !data) return []

  return (data as any[]).map((conv): ConversationRecord => ({
    id: conv.id,
    name: conv.contact_name || 'Unknown',
    company: conv.company || 'Prospect',
    preview: conv.last_message_preview || '',
    time: relativeTime(conv.last_message_at),
    priority: (conv.priority as 'High' | 'Medium' | 'Low') || 'Medium',
    score: conv.score || 0,
    channel: conv.channel || 'Web',
    status: conv.status || 'Open',
    unread: conv.unread_count || 0,
    messages: (conv.messages || []).map((m: any) => ({
      id: m.id,
      sender: 'client' as const,
      text: m.content || '',
      time: relativeTime(m.created_at),
    })),
  }))
}

// ─── SITE REQUESTS ───────────────────────────────────────────────────────────

export async function getSiteRequests(): Promise<SiteRequestRecord[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('site_requests')
    .select('*')
    .order('created_at', { ascending: false })
  if (error || !data) return []

  return (data as any[]).map((row): SiteRequestRecord => ({
    id: row.id,
    request: row.title || 'New Site Build',
    company: row.company || 'Prospect',
    type: row.type || 'Website',
    priority: (row.priority as 'High' | 'Medium' | 'Low') || 'Medium',
    stage: row.stage || 'New',
    owner: row.contact_name || 'Unassigned',
    lastActivity: relativeTime(row.updated_at),
    value: row.budget_max ? `$${Number(row.budget_max).toLocaleString()}` : '$0',
    nextAction: row.next_action || 'Review request',
  }))
}

// ─── DASHBOARD METRICS (Overview + Leads) ────────────────────────────────────

export async function getDashboardMetrics() {
  const supabase = await createClient()
  const { data: allLeads } = await supabase.from('leads').select('*')
  const leads = allLeads || []

  // Snapshot data for delta comparison (7 days ago)
  const lastWeekDate = new Date()
  lastWeekDate.setDate(lastWeekDate.getDate() - 7)
  const lastWeekStr = lastWeekDate.toISOString().split('T')[0]

  const { data: snapshots } = await supabase
    .from('metric_snapshots')
    .select('*')
    .eq('section', 'leads')
    .gte('snapshot_date', lastWeekStr)

  const snapshotMap: Record<string, number[]> = {}
  if (snapshots) {
    for (const s of snapshots as any[]) {
      if (!snapshotMap[s.metric_label]) snapshotMap[s.metric_label] = []
      snapshotMap[s.metric_label].push(Number(s.value_numeric))
    }
  }

  function getDelta(label: string, current: number): string {
    const vals = snapshotMap[label]
    if (!vals || vals.length < 2) return '+0%'
    const prev = vals[vals.length - 7] ?? vals[0]
    if (prev === 0) return '+0%'
    const pct = Math.round(((current - prev) / prev) * 100)
    return `${pct >= 0 ? '+' : ''}${pct}%`
  }

  function getSparkline(label: string): number[] {
    return (snapshotMap[label] || []).slice(-12)
  }

  const totalLeads = leads.length
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const newLeads = leads.filter(l => new Date(l.created_at) >= sevenDaysAgo).length
  const qualifiedLeads = leads.filter(l => l.status === 'Qualified').length

  // Pipeline value: sum of all non-null deal values
  const pipelineValue = leads.reduce((s, l) => s + (Number(l.value) || 0), 0)
  const activePipelineValue = leads
    .filter(l => l.status !== 'Won')
    .reduce((s, l) => s + (Number(l.value) || 0), 0)
  const wonValue = leads
    .filter(l => l.status === 'Won')
    .reduce((s, l) => s + (Number(l.value) || 0), 0)
  const leadsWithValue = leads.filter(l => Number(l.value) > 0).length
  const avgDealSize = leadsWithValue > 0 ? Math.round(pipelineValue / leadsWithValue) : 0

  // Pipeline stages — include value per stage
  const stageOrder = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won']
  const pipelineStages: PipelineStage[] = stageOrder
    .map(stage => {
      const stageLeads = leads.filter(l => l.status === stage)
      const count = stageLeads.length
      const value = stageLeads.reduce((s, l) => s + (Number(l.value) || 0), 0)
      return { label: stage as LeadStage, count, value, color: getStageColor(stage) }
    })
    .filter(s => s.count > 0)
    .map(s => ({
      ...s,
      valueFormatted: `£${s.value.toLocaleString()}`,
      percentage: totalLeads > 0 ? Math.round((s.count / totalLeads) * 100) : 0,
      valuePercentage: pipelineValue > 0 ? Math.round((s.value / pipelineValue) * 100) : 0,
    }))

  // Source performance
  const sourceMap = new Map<string, { leads: number; value: number }>()
  leads.forEach(l => {
    const src = l.source || 'Unknown'
    if (!sourceMap.has(src)) sourceMap.set(src, { leads: 0, value: 0 })
    const c = sourceMap.get(src)!
    c.leads += 1; c.value += Number(l.value) || 0
  })
  const sourcePerformance: LeadSourcePerformance[] = Array.from(sourceMap.entries())
    .map(([source, d]) => ({
      source: source as any,
      leads: d.leads,
      conversion: totalLeads > 0 ? `${Math.round((d.leads / totalLeads) * 100)}%` : '0%',
      value: `$${d.value.toLocaleString()}`,
      bar: totalLeads > 0 ? Math.round((d.leads / totalLeads) * 100) : 0,
      color: getSourceColor(source),
    }))
    .sort((a, b) => b.leads - a.leads)

  // Owner performance
  const assignedIds = [...new Set(leads.map(l => l.assigned_to).filter(Boolean))] as string[]
  const profilesMap: Record<string, { full_name: string; email: string }> = {}
  if (assignedIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles').select('user_id, full_name, email').in('user_id', assignedIds)
    profiles?.forEach(p => { profilesMap[p.user_id] = { full_name: p.full_name || 'Unknown', email: p.email || '' } })
  }
  const ownerMap = new Map<string, { leads: number; won: number; value: number }>()
  leads.forEach(l => {
    if (!l.assigned_to) return
    if (!ownerMap.has(l.assigned_to)) ownerMap.set(l.assigned_to, { leads: 0, won: 0, value: 0 })
    const c = ownerMap.get(l.assigned_to)!
    c.leads += 1; if (l.status === 'Won') c.won += 1; c.value += Number(l.value) || 0
  })
  const ownerPerformance: OwnerPerformance[] = Array.from(ownerMap.entries())
    .map(([id, d]) => ({
      owner: profilesMap[id]?.full_name || 'Unknown',
      leads: d.leads, response: '—', meetings: d.won,
      revenue: `$${d.value.toLocaleString()}`,
      avatar: (profilesMap[id]?.full_name || 'UN').substring(0, 2).toUpperCase(),
    }))
    .sort((a, b) => b.leads - a.leads)

  const metrics: Metric[] = [
    { label: 'Total leads', value: `${totalLeads}`, delta: getDelta('total_leads', totalLeads), icon: 'users', sparkline: getSparkline('total_leads') },
    { label: 'New this week', value: `${newLeads}`, delta: getDelta('new_leads_week', newLeads), icon: 'calendar', sparkline: getSparkline('new_leads_week') },
    { label: 'Qualified leads', value: `${qualifiedLeads}`, delta: getDelta('qualified_leads', qualifiedLeads), icon: 'diamond', sparkline: getSparkline('qualified_leads') },
    { label: 'Pipeline value', value: `£${pipelineValue.toLocaleString()}`, delta: getDelta('pipeline_value', pipelineValue), icon: 'dollar', sparkline: getSparkline('pipeline_value') },
  ]

  const pipelineSummary = {
    total: pipelineValue,
    active: activePipelineValue,
    won: wonValue,
    avgDeal: avgDealSize,
    totalFormatted: `£${pipelineValue.toLocaleString()}`,
    activeFormatted: `£${activePipelineValue.toLocaleString()}`,
    wonFormatted: `£${wonValue.toLocaleString()}`,
    avgDealFormatted: `£${avgDealSize.toLocaleString()}`,
  }

  return { metrics, pipelineStages, pipelineSummary, sourcePerformance, ownerPerformance, totalLeads }
}

// ─── SECTION METRICS ─────────────────────────────────────────────────────────

export async function getVideoMetrics() {
  const supabase = await createClient()
  const { data: snaps } = await supabase
    .from('metric_snapshots').select('*').eq('section', 'videos')
  const snap = (snaps || []).reduce((acc: Record<string, number[]>, s) => {
    if (!acc[s.metric_label]) acc[s.metric_label] = []
    acc[s.metric_label].push(Number(s.value_numeric))
    return acc
  }, {})

  const { data: videos } = await supabase.from('videos').select('watch_rate, meetings_booked, created_at, status')
  const vids = videos || []
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const totalVideos = vids.length
  const sentThisWeek = vids.filter(v => v.status !== 'Draft' && new Date(v.created_at) >= sevenDaysAgo).length
  const avgWatchRate = vids.filter(v => v.watch_rate > 0).length > 0
    ? Math.round(vids.filter(v => v.watch_rate > 0).reduce((s, v) => s + v.watch_rate, 0) / vids.filter(v => v.watch_rate > 0).length)
    : 0
  const meetingsBooked = vids.reduce((s, v) => s + (v.meetings_booked || 0), 0)

  function delta(label: string, cur: number) {
    const vals = snap[label]; if (!vals || vals.length < 7) return '+0%'
    const prev = vals[vals.length - 7] ?? vals[0]; if (prev === 0) return '+0%'
    const pct = Math.round(((cur - prev) / prev) * 100)
    return `${pct >= 0 ? '+' : ''}${pct}%`
  }

  return [
    { label: 'Total videos', value: `${totalVideos}`, delta: delta('total_videos', totalVideos) },
    { label: 'Sent this week', value: `${sentThisWeek}`, delta: delta('sent_this_week', sentThisWeek) },
    { label: 'Avg watch rate', value: `${avgWatchRate}%`, delta: delta('avg_watch_rate', avgWatchRate) },
    { label: 'Meetings booked', value: `${meetingsBooked}`, delta: delta('meetings_booked', meetingsBooked) },
  ]
}

export async function getEmailMetrics() {
  const supabase = await createClient()
  const { data: templates } = await supabase.from('email_templates').select('*')
  const tmpl = (templates as any[]) || []
  const { data: snaps } = await supabase.from('metric_snapshots').select('*').eq('section', 'emails')
  const snap = (snaps || []).reduce((acc: Record<string, number[]>, s) => {
    if (!acc[s.metric_label]) acc[s.metric_label] = []
    acc[s.metric_label].push(Number(s.value_numeric))
    return acc
  }, {})

  const totalSent = tmpl.reduce((s, t) => s + (t.sent_count || 0), 0)
  const totalOpen = tmpl.reduce((s, t) => s + (t.open_count || 0), 0)
  const totalClick = tmpl.reduce((s, t) => s + (t.click_count || 0), 0)
  const totalReply = tmpl.reduce((s, t) => s + (t.reply_count || 0), 0)
  const meetingsBooked = tmpl.reduce((s, t) => s + (t.meetings_booked || t.meeting_count || 0), 0)
  const sequencesActive = tmpl.filter((t) => ['active', 'running', 'scheduled'].includes(String(t.status || '').toLowerCase())).length
  const bounced = tmpl.reduce((s, t) => s + (t.bounce_count || 0), 0)
  const openRate = totalSent > 0 ? Math.round((totalOpen / totalSent) * 100) : 0
  const clickRate = totalSent > 0 ? Math.round((totalClick / totalSent) * 100) : 0
  const replyRate = totalSent > 0 ? Math.round((totalReply / totalSent) * 100) : 0
  const deliverability = totalSent > 0 ? Math.max(0, Math.round(((totalSent - bounced) / totalSent) * 1000) / 10) : 98.1
  const revenueInfluenced = tmpl.reduce((s, t) => s + (Number(t.revenue_influenced) || Number(t.value_influenced) || 0), 0) || totalReply * 1200

  function delta(label: string, cur: number) {
    const vals = snap[label]; if (!vals || vals.length < 7) return '+0%'
    const prev = vals[vals.length - 7] ?? vals[0]; if (prev === 0) return '+0%'
    const pct = Math.round(((cur - prev) / prev) * 100)
    return `${pct >= 0 ? '+' : ''}${pct}%`
  }

  return [
    { label: 'Emails sent', value: `${totalSent}`, delta: delta('emails_sent', totalSent) },
    { label: 'Open rate', value: `${openRate}%`, delta: delta('open_rate', openRate) },
    { label: 'Click rate', value: `${clickRate}%`, delta: delta('click_rate', clickRate) },
    { label: 'Reply rate', value: `${replyRate}%`, delta: delta('reply_rate', replyRate) },
    { label: 'Meetings booked', value: `${meetingsBooked}`, delta: delta('meetings_booked', meetingsBooked) },
    { label: 'Sequences active', value: `${sequencesActive}`, delta: delta('sequences_active', sequencesActive) },
    { label: 'Deliverability', value: `${deliverability}%`, delta: delta('deliverability', deliverability) },
    { label: 'Revenue influenced', value: `$${Math.round(revenueInfluenced / 1000)}K`, delta: delta('revenue_influenced', revenueInfluenced) },
  ]
}

export async function getSiteRequestMetrics() {
  const supabase = await createClient()
  const { data } = await supabase.from('site_requests').select('stage, budget_max, created_at')
  const reqs = data || []
  const { data: snaps } = await supabase.from('metric_snapshots').select('*').eq('section', 'site_requests')
  const snap = (snaps || []).reduce((acc: Record<string, number[]>, s) => {
    if (!acc[s.metric_label]) acc[s.metric_label] = []
    acc[s.metric_label].push(Number(s.value_numeric))
    return acc
  }, {})

  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const openReqs = reqs.filter(r => r.stage !== 'Launched').length
  const newThisWeek = reqs.filter(r => new Date(r.created_at) >= sevenDaysAgo).length
  const qualified = reqs.filter(r => ['Qualified', 'Discovery', 'Scoping', 'In Build'].includes(r.stage)).length
  const pipelineValue = reqs.reduce((s, r) => s + (Number(r.budget_max) || 0), 0)

  function delta(label: string, cur: number) {
    const vals = snap[label]; if (!vals || vals.length < 7) return '+0%'
    const prev = vals[vals.length - 7] ?? vals[0]; if (prev === 0) return '+0%'
    const pct = Math.round(((cur - prev) / prev) * 100)
    return `${pct >= 0 ? '+' : ''}${pct}%`
  }

  return [
    { label: 'Open requests', value: `${openReqs}`, delta: delta('open_requests', openReqs) },
    { label: 'New this week', value: `${newThisWeek}`, delta: delta('new_this_week', newThisWeek) },
    { label: 'Qualified', value: `${qualified}`, delta: delta('qualified', qualified) },
    { label: 'Pipeline value', value: `$${pipelineValue.toLocaleString()}`, delta: delta('pipeline_value', pipelineValue) },
  ]
}

export async function getMessageMetrics() {
  const supabase = await createClient()
  const { data } = await supabase.from('conversations').select('status, unread_count, resolved_at')
  const convs = data || []
  const { data: snaps } = await supabase.from('metric_snapshots').select('*').eq('section', 'messages')
  const snap = (snaps || []).reduce((acc: Record<string, number[]>, s) => {
    if (!acc[s.metric_label]) acc[s.metric_label] = []
    acc[s.metric_label].push(Number(s.value_numeric))
    return acc
  }, {})

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const open = convs.filter(c => c.status === 'Open' || c.status === 'Waiting').length
  const unread = convs.reduce((s, c) => s + (c.unread_count || 0), 0)
  const waiting = convs.filter(c => c.status === 'Waiting').length
  const resolved = convs.filter(c => c.resolved_at && new Date(c.resolved_at) >= today).length

  // Also use snapshots for previous-period values for the pill badges
  const snapOpen = (snap['open_conversations']?.slice(-1)[0] || open)
  const snapUnread = (snap['unread_messages']?.slice(-1)[0] || unread)
  const snapWaiting = (snap['waiting']?.slice(-1)[0] || waiting)
  const snapResolved = (snap['resolved_today']?.slice(-1)[0] || resolved)

  return {
    unread: unread > 0 ? unread : snapUnread,
    waiting: waiting > 0 ? waiting : snapWaiting,
    open: open > 0 ? open : snapOpen,
    resolved: resolved > 0 ? resolved : snapResolved,
  }
}

export async function getIntegrationStatus() {
  const supabase = await createClient()
  const { data } = await supabase.from('integrations').select('status')
  const integrations = data || []
  const connected = integrations.filter(i => i.status === 'connected' || i.status === 'Configured').length
  const pending = integrations.filter(i => i.status === 'pending').length
  const suggested = Math.max(0, integrations.length - connected - pending)
  return { connected, suggested, pending }
}

// ─── TASKS, ACTIVITY, RECOMMENDATIONS, GOALS ─────────────────────────────────

export async function getTasks(): Promise<TaskItem[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('lead_tasks').select('*').order('due_at', { ascending: true }).limit(10)
  if (!data) return []
  return data.map((t) => ({
    id: t.id,
    label: t.title || 'Task',
    time: t.due_at ? new Date(t.due_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No due date',
    checked: t.is_done || false,
  }))
}

export async function getRecentActivity(): Promise<ActivityItem[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('activity_feed').select('*').order('created_at', { ascending: false }).limit(10)
  if (!data) return []
  return data.map(e => ({
    title: e.description || 'Activity',
    time: relativeTime(e.created_at),
  }))
}

export async function getRecommendations(): Promise<Recommendation[]> {
  const supabase = await createClient()
  const { data: leads } = await supabase
    .from('leads').select('id, name, company, score, engagement').order('score', { ascending: false }).limit(5)
  if (!leads) return []
  return leads.map((lead: any) => {
    if ((lead.score || 0) >= 80) return {
      title: `Follow up with ${lead.name}`,
      detail: `High score (${lead.score}) — ready to progress`,
      action: 'Follow up', icon: 'sparkle' as IconName, tone: 'purple' as const,
    }
    if ((lead.engagement || 0) < 50) return {
      title: `Nudge ${lead.name}`,
      detail: `Low engagement (${lead.engagement}%) — needs attention`,
      action: 'Nudge', icon: 'clock' as IconName, tone: 'yellow' as const,
    }
    return {
      title: `Create video for ${lead.company}`,
      detail: `Score ${lead.score} — good prospect for personalised video`,
      action: 'Create video', icon: 'video' as IconName, tone: 'blue' as const,
    }
  })
}

export async function getGoals() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('goals').select('*').order('created_at', { ascending: true })
  if (!data) return []
  return data.map(g => ({
    label: g.label,
    current: Number(g.current_value),
    target: Number(g.target_value),
    unit: g.unit as 'count' | 'dollar',
    pct: g.target_value > 0 ? Math.round((g.current_value / g.target_value) * 100) : 0,
  }))
}

// ─── LEAD EVENTS (per-lead timeline) ─────────────────────────────────────────

export type LeadEventRow = {
  id: string
  type: string
  note: string | null
  title: string | null
  created_at: string
  metadata: Record<string, unknown> | null
}

export async function getLeadEvents(leadId: string): Promise<LeadEventRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('lead_events')
    .select('id, type, note, title, created_at, metadata')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(20)
  return (data || []) as LeadEventRow[]
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

export async function isAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const email = normalizeEmail(user.email)
  if (isFoundingAdminEmail(email)) {
    await supabase
      .from('user_profiles')
      .upsert({ user_id: user.id, email, role: 'admin' }, { onConflict: 'user_id' })
    return true
  }

  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('user_id', user.id).single()
  if (profile?.role === 'admin') return true

  const { data: licensedUser } = await supabase
    .from('licensed_users')
    .select('role, status')
    .eq('email', email)
    .single()

  return licensedUser?.role === 'admin' && licensedUser?.status === 'active'
}

export async function canUseSystem() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const email = normalizeEmail(user.email)
  if (isFoundingAdminEmail(email)) return true

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (profile?.role === 'admin') return true

  const { data: licensedUser } = await supabase
    .from('licensed_users')
    .select('status')
    .eq('email', email)
    .single()

  return licensedUser?.status === 'active' || licensedUser?.status === 'pending'
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getStageColor(stage: string): string {
  const colors: Record<string, string> = {
    'New': '#2f6bff', 'Contacted': '#19a9ff', 'Qualified': '#10d184',
    'Proposal Sent': '#8c5cff', 'Negotiation': '#ff9b2f', 'Won': '#f6c445',
  }
  return colors[stage] || '#2f6bff'
}

function getSourceColor(source: string): string {
  const colors: Record<string, string> = {
    'Website': '#2f6bff', 'Referral': '#17d7c1', 'Cold outreach': '#8c5cff',
    'Ads': '#ff9b2f', 'Organic': '#22c55e',
  }
  return colors[source] || '#2f6bff'
}
