'use server'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import {
  leadsApi,
  activityFeedApi,
  tasksApi,
  prefsApi,
  videoAssetsApi,
  emailWorkspaceApi,
  dashboardWorkspaceApi,
  messagingApi,
  type VideoAssetDto,
} from '@/lib/api/client'
import { platformServerFetch } from '@/lib/api/platform-server'
import { isFoundingAdminEmail, normalizeEmail } from '@/lib/license'
import type {
  Lead, LeadStage, IconName, PipelineStage, LeadSourcePerformance,
  OwnerPerformance, Metric, TaskItem, ActivityItem, Recommendation
} from '@/components/leads/leads-types'
import type {
  LeadRecord, VideoRecord, EmailRecord, EmailSendRecord, ConversationRecord, SiteRequestRecord, CrmSetupConfig
} from '@/components/crm-dashboard/types'

const getToken = cache(async (): Promise<string | null> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
})

const getAuthContext = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
})

const getRawLeads = cache(async () => {
  const token = await getToken()
  if (!token) return []
  return leadsApi.list(token).catch(() => [])
})

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

function videoMetadata(value: VideoAssetDto['metadata']): Record<string, any> {
  if (!value) return {}
  if (typeof value === 'object') return value
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export async function getCrmSetupConfig(): Promise<CrmSetupConfig> {
  const defaults: CrmSetupConfig = {
    companyName: 'Online2Day',
    defaultSenderName: 'Online2Day Team',
    defaultSenderEmail: 'info@online2day.com',
    bookingUrl: 'https://calendly.com/online2day/demo',
    defaultCtaLabel: 'Book a call',
    defaultCtaUrl: 'https://calendly.com/online2day/demo',
    timezone: 'Europe/London',
    followupHours: '24',
    hotLeadScore: '80',
    pipelineStages: 'New, Contacted, Qualified, Proposal Sent, Negotiation, Won',
  }

  const token = await getToken()
  if (!token) return defaults

  const keys = [
    'config.companyName', 'config.defaultSenderName', 'config.defaultSenderEmail',
    'config.bookingUrl', 'config.defaultCtaLabel', 'config.defaultCtaUrl',
    'config.timezone', 'config.followupHours', 'config.hotLeadScore', 'config.pipelineStages',
  ]

  try {
    const items = await prefsApi.getMany(token, keys)
    const prefs = new Map(items.map(i => [i.key, i.value]))
    return {
      companyName: prefs.get('config.companyName') || defaults.companyName,
      defaultSenderName: prefs.get('config.defaultSenderName') || defaults.defaultSenderName,
      defaultSenderEmail: prefs.get('config.defaultSenderEmail') || defaults.defaultSenderEmail,
      bookingUrl: prefs.get('config.bookingUrl') || defaults.bookingUrl,
      defaultCtaLabel: prefs.get('config.defaultCtaLabel') || defaults.defaultCtaLabel,
      defaultCtaUrl: prefs.get('config.defaultCtaUrl') || defaults.defaultCtaUrl,
      timezone: prefs.get('config.timezone') || defaults.timezone,
      followupHours: prefs.get('config.followupHours') || defaults.followupHours,
      hotLeadScore: prefs.get('config.hotLeadScore') || defaults.hotLeadScore,
      pipelineStages: prefs.get('config.pipelineStages') || defaults.pipelineStages,
    }
  } catch {
    return defaults
  }
}

// ─── LEADS ────────────────────────────────────────────────────────────────────

export async function getLeads(): Promise<Lead[]> {
  const data = await getRawLeads()
  return data.map((row): Lead => ({
      id: row.id,
      contactName: row.name || 'Unknown',
      role: row.role || 'Contact',
      company: row.company || 'Private',
      companyMark: (row.company || 'P').substring(0, 2).toUpperCase(),
      logoClass: 'logoGeneric',
      score: row.score || 0,
      stage: (row.status as LeadStage) || 'New',
      owner: 'Unassigned',
      source: (row.source as any) || 'Website',
      sourceIcon: 'globe',
      lastActivity: relativeTime(row.lastContactedAt ?? null),
      engagement: row.engagement || 0,
      value: row.value ? `£${Number(row.value).toLocaleString()}` : '£0',
      nextAction: row.nextAction || 'Follow up',
      email: row.email || undefined,
  }))
}

export async function getLead(id: string): Promise<Lead | null> {
  const token = await getToken()
  if (!token) return null
  try {
    const row = await leadsApi.get(token, id)
    return {
      id: row.id,
      contactName: row.name || 'Unknown',
      role: row.role || 'Contact',
      company: row.company || 'Private',
      companyMark: (row.company || 'P').substring(0, 2).toUpperCase(),
      logoClass: 'logoGeneric',
      score: row.score || 0,
      stage: (row.status as LeadStage) || 'New',
      owner: 'Unassigned',
      source: (row.source as any) || 'Website',
      sourceIcon: 'globe',
      lastActivity: relativeTime(row.lastContactedAt ?? null),
      engagement: row.engagement || 0,
      value: row.value ? `£${Number(row.value).toLocaleString()}` : '£0',
      nextAction: row.nextAction || 'Follow up',
      email: row.email || undefined,
      phone: row.phone || undefined,
      notes: row.notes || undefined,
      website: row.website || undefined,
    }
  } catch { return null }
}

export async function getLeadRecords(): Promise<LeadRecord[]> {
  const data = await getRawLeads()
  return data.map((row): LeadRecord => ({
      id: row.id,
      contactName: row.name || 'Unknown',
      role: row.role || 'Contact',
      company: row.company || 'Private',
      companyMark: (row.company || 'P').substring(0, 2).toUpperCase(),
      score: row.score || 0,
      stage: (row.status as LeadStage) || 'New',
      owner: 'Unassigned',
      source: row.source || 'Website',
      lastActivity: relativeTime(row.lastContactedAt ?? null),
      engagement: row.engagement || 0,
      value: row.value ? `£${Number(row.value).toLocaleString()}` : '£0',
      nextAction: row.nextAction || 'Follow up',
  }))
}

// ─── VIDEOS ──────────────────────────────────────────────────────────────────

export async function getVideos(): Promise<VideoRecord[]> {
  const token = await getToken()
  if (!token) return []
  try {
    const assets = await videoAssetsApi.list(token, { limit: 250 })
    return assets.map((row): VideoRecord => {
      const metadata = videoMetadata(row.metadata)
      const duration = Number(metadata.duration || metadata.recording?.duration || 0)
      const cta = metadata.cta && typeof metadata.cta === 'object' ? String(metadata.cta.label || '') : ''
      const hasMedia = Boolean(row.storage_path || row.url) && Number.isFinite(duration) && duration > 0
      const status = hasMedia ? (typeof metadata.status === 'string' ? metadata.status : 'Ready') : 'Needs media'
      return {
        id: row.id,
        leadId: row.lead_id,
        slug: row.slug || '',
        title: row.name || 'Untitled video',
        company: row.lead?.company || (row.lead_id ? 'Prospect' : 'Shared library'),
        duration: duration ? formatDuration(Math.round(duration)) : '00:00',
        funnelStage: row.lead?.status || 'Unassigned',
        owner: String(metadata.createdBy || metadata.uploadedBy || 'Online2Day'),
        channel: hasMedia ? 'Hosted page' : 'Editor project',
        cta: cta || 'Watch video',
        status,
        watchRate: Number(metadata.watchRate || 0),
        lastViewed: row.view_count ? `${row.view_count} view${row.view_count === 1 ? '' : 's'}` : 'Not viewed',
        replies: Number(metadata.replyCount || 0),
        nextAction: hasMedia ? 'Share or edit' : 'Add media',
        createdAt: row.created_at,
        viewCount: row.view_count || 0,
        hasMedia,
      }
    })
  } catch {
    return []
  }
}

// ─── EMAILS ──────────────────────────────────────────────────────────────────

export async function getEmails(): Promise<EmailRecord[]> {
  const token = await getToken()
  if (!token) return []
  try {
    const [data, sends] = await Promise.all([
      emailWorkspaceApi.listTemplates(token),
      emailWorkspaceApi.listSends(token, 1_000),
    ])
    return data.map((row): EmailRecord => {
      const templateSends = sends.filter((send) => send.template_id === row.id)
      const sent = templateSends.length
      const openCount = templateSends.filter((send) => Boolean(send.opened_at)).length
      const clickCount = templateSends.filter((send) => Boolean(send.clicked_at)).length
      const replyCount = templateSends.filter((send) => Boolean(send.replied_at)).length
      return {
        id: row.id,
        template: row.name || 'Untitled template',
        body: row.body || '',
        category: row.category || 'Outreach',
        audience: row.audience || 'All leads',
        stage: row.stage || 'Outreach',
        owner: 'Online2Day',
        subject: row.subject || '(No subject)',
        sent,
        opens: sent > 0 ? Math.round((openCount / sent) * 100) : 0,
        clicks: sent > 0 ? Math.round((clickCount / sent) * 100) : 0,
        replies: sent > 0 ? Math.round((replyCount / sent) * 100) : 0,
        meetings: Math.max(0, row.meetings_booked || 0),
        cta: row.cta_label || 'Reply now',
        lastEdited: relativeTime(row.updated_at || row.created_at),
        nextAction: sent > 0 ? 'Send or edit' : 'Send first email',
      }
    })
  } catch {
    return []
  }
}

export async function getRecentEmailSends(): Promise<EmailSendRecord[]> {
  const token = await getToken()
  if (!token) return []
  try {
    const data = await emailWorkspaceApi.listSends(token, 50)
    return data.map((row): EmailSendRecord => ({
      id: row.id,
      leadId: row.lead_id,
      recipientName: row.lead?.name || 'Manual recipient',
      recipientEmail: row.lead?.email || '',
      company: row.lead?.company || '—',
      templateName: row.template?.name || 'Custom email',
      subject: row.subject || '(No subject)',
      status: String(row.status || 'sent').split(':')[0].replaceAll('_', ' '),
      sentAt: row.sent_at || row.created_at,
      openedAt: row.opened_at,
      clickedAt: row.clicked_at,
    }))
  } catch {
    return []
  }
}

export async function getEmailComposerData() {
  const token = await getToken()
  if (!token) return { leads: [], videos: [] }
  try {
    const [leads, videos] = await Promise.all([
      videoAssetsApi.leads(token),
      videoAssetsApi.list(token, { limit: 200 }),
    ])
    const previewEntries = await Promise.all(videos.slice(0, 50).map(async (video) => {
      if (!video.storage_path && !video.url) return [video.id, video.url || ''] as const
      try {
        const playback = await videoAssetsApi.playback(token, video.id)
        return [video.id, playback.url || ''] as const
      } catch {
        return [video.id, video.url || ''] as const
      }
    }))
    const previewUrls = new Map(previewEntries)
    return {
      leads: leads.slice(0, 200).map((lead) => ({
        id: lead.id,
        name: lead.name || 'Unknown',
        company: lead.company || 'Private',
        email: lead.email || '',
        status: lead.status || 'New',
      })),
      videos: videos.map((video) => ({
        id: video.id,
        leadId: video.lead_id,
        name: video.name || 'Untitled video',
        slug: video.slug || '',
        createdAt: video.created_at || '',
        storagePath: previewUrls.get(video.id) ? (video.storage_path || '') : '',
        previewUrl: previewUrls.get(video.id) || '',
        metadata: videoMetadata(video.metadata),
      })),
    }
  } catch {
    return { leads: [], videos: [] }
  }
}

// ─── CONVERSATIONS / MESSAGES ────────────────────────────────────────────────

export async function getConversations(): Promise<ConversationRecord[]> {
  const token = await getToken()
  if (!token) return []
  try {
    if (!(await getAdminStatus())) {
      const own = await messagingApi.conversations(token)
      return own.map((conversation): ConversationRecord => ({
        id: conversation.id, name: conversation.name, company: conversation.company || 'Online2Day workspace',
        preview: conversation.preview, time: relativeTime(conversation.lastMessageAt), priority: (conversation.priority as 'High' | 'Medium' | 'Low') || 'Medium',
        score: 0, channel: conversation.channel, status: conversation.status, contactEmail: conversation.contactEmail || '', contactPhone: conversation.contactPhone || '', unread: conversation.unread,
        messages: conversation.messages.map((message) => ({ id: message.id, sender: message.isMine ? 'agent' : 'client', text: message.content, time: relativeTime(message.createdAt), attachmentLabel: message.attachmentLabel || undefined, deliveryStatus: message.deliveryStatus, channel: message.channel })),
      }))
    }
    const data = await dashboardWorkspaceApi.conversations(token)
    return data.map((conv): ConversationRecord => ({
    id: conv.id,
    name: conv.contact_name || 'Unknown',
    company: conv.company || 'Prospect',
    preview: conv.last_message_preview || '',
    time: relativeTime(conv.last_message_at),
    priority: (conv.priority as 'High' | 'Medium' | 'Low') || 'Medium',
    score: conv.score || 0,
    channel: conv.channel || 'Web',
    status: conv.status || 'Open',
    contactEmail: conv.contact_email || '',
    contactPhone: conv.contact_phone || '',
    unread: conv.unread_count || 0,
    messages: (conv.messages || [])
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((m) => ({
      id: m.id,
      sender: m.sender_type === 'visitor' || m.sender_type === 'provider' || (m.conversation_user_id && m.conversation_user_id === m.sender_id) ? 'client' as const : 'agent' as const,
      text: m.content || '',
      time: relativeTime(m.created_at),
      attachmentLabel: m.attachment_label || undefined,
      deliveryStatus: m.delivery_status || undefined,
      channel: m.channel || undefined,
    })),
    }))
  } catch {
    return []
  }
}

// ─── SITE REQUESTS ───────────────────────────────────────────────────────────

export async function getSiteRequests(): Promise<SiteRequestRecord[]> {
  const token = await getToken()
  if (!token) return []
  try {
    const data = await dashboardWorkspaceApi.siteRequests(token)
    return data.map((row): SiteRequestRecord => ({
    id: row.id,
    leadId: row.lead_id,
    request: row.title || 'New Site Build',
    company: row.company || 'Prospect',
    type: row.type || 'Website',
    priority: (row.priority as 'High' | 'Medium' | 'Low') || 'Medium',
    stage: row.stage || 'New',
    owner: row.contact_name || 'Unassigned',
    contactEmail: row.contact_email || '',
    description: row.description || '',
    timelineWeeks: Number(row.timeline_weeks) || 0,
    lastActivity: relativeTime(row.updated_at),
    value: row.budget_max ? `£${Number(row.budget_max).toLocaleString()}` : '£0',
    nextAction: row.next_action || 'Review request',
    }))
  } catch {
    return []
  }
}

// ─── DASHBOARD METRICS (Overview + Leads) ────────────────────────────────────

export async function getDashboardMetrics() {
  const token = await getToken()
  const [leads, support] = await Promise.all([
    getRawLeads(),
    token ? dashboardWorkspaceApi.support(token, 'leads').catch(() => null) : Promise.resolve(null),
  ])

  // Snapshot data for delta comparison (7 days ago)
  const lastWeekDate = new Date()
  lastWeekDate.setDate(lastWeekDate.getDate() - 7)
  const lastWeekStr = lastWeekDate.toISOString().split('T')[0]

  const snapshots = (support?.snapshots || []).filter((snapshot) => snapshot.snapshot_date >= lastWeekStr)

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
  const newLeads = leads.filter(l => new Date(l.createdAt) >= sevenDaysAgo).length
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
  const ownerMap = new Map<string, { leads: number; won: number; value: number }>()
  leads.forEach(l => {
    if (!l.assignedTo) return
    if (!ownerMap.has(l.assignedTo)) ownerMap.set(l.assignedTo, { leads: 0, won: 0, value: 0 })
    const c = ownerMap.get(l.assignedTo)!
    c.leads += 1; if (l.status === 'Won') c.won += 1; c.value += Number(l.value) || 0
  })
  const ownerPerformance: OwnerPerformance[] = Array.from(ownerMap.entries())
    .map(([id, d]) => ({
      owner: 'Team member',
      leads: d.leads, response: '—', meetings: d.won,
      revenue: `$${d.value.toLocaleString()}`,
      avatar: id.substring(0, 2).toUpperCase(),
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
  const videos = await getVideos()
  const totalViews = videos.reduce((sum, video) => sum + video.viewCount, 0)
  const ready = videos.filter((video) => video.hasMedia).length
  const drafts = videos.length - ready
  return [
    { label: 'Total videos', value: String(videos.length), delta: 'Live' },
    { label: 'Ready to share', value: String(ready), delta: ready ? 'Available' : 'None yet' },
    { label: 'Total views', value: String(totalViews), delta: totalViews ? 'Tracked' : 'No views yet' },
    { label: 'Draft projects', value: String(drafts), delta: drafts ? 'Needs media' : 'All ready' },
  ]
}

export async function getEmailMetrics() {
  const token = await getToken()
  if (!token) return []
  const [tmpl, sends, mailbox] = await Promise.all([
    emailWorkspaceApi.listTemplates(token).catch(() => []),
    emailWorkspaceApi.listSends(token, 1_000).catch(() => []),
    emailWorkspaceApi.mailbox(token, 'inbox', 1).catch(() => ({ messages: [], unread: 0 })),
  ])
  const totalSent = sends.length
  const totalOpen = sends.filter((send) => Boolean(send.opened_at)).length
  const totalClick = sends.filter((send) => Boolean(send.clicked_at)).length
  const totalReply = sends.filter((send) => Boolean(send.replied_at)).length
  const openRate = totalSent > 0 ? Math.round((totalOpen / totalSent) * 100) : 0
  const clickRate = totalSent > 0 ? Math.round((totalClick / totalSent) * 100) : 0
  const replyRate = totalSent > 0 ? Math.round((totalReply / totalSent) * 100) : 0

  return [
    { label: 'Unread', value: `${mailbox.unread}`, delta: mailbox.unread ? 'Needs attention' : 'All caught up' },
    { label: 'Templates', value: `${tmpl.length}`, delta: 'API synced' },
    { label: 'Emails sent', value: `${totalSent}`, delta: 'Recorded sends' },
    { label: 'Open rate', value: `${openRate}%`, delta: totalSent ? 'Measured events' : 'No sends yet' },
    { label: 'Click rate', value: `${clickRate}%`, delta: totalSent ? 'Measured events' : 'No sends yet' },
    { label: 'Reply rate', value: `${replyRate}%`, delta: totalSent ? 'Recorded replies' : 'No sends yet' },
  ]
}

export async function getSiteRequestMetrics() {
  const token = await getToken()
  if (!token) return []
  const reqs = await dashboardWorkspaceApi.siteRequests(token).catch(() => [])

  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const openReqs = reqs.filter(r => r.stage !== 'Launched').length
  const newThisWeek = reqs.filter(r => new Date(r.created_at) >= sevenDaysAgo).length
  const qualified = reqs.filter(r => ['Qualified', 'Discovery', 'Scoping', 'In Build'].includes(r.stage || '')).length
  const pipelineValue = reqs.reduce((s, r) => s + (Number(r.budget_max) || 0), 0)

  return [
    { label: 'Open requests', value: `${openReqs}`, delta: 'Live records' },
    { label: 'New this week', value: `${newThisWeek}`, delta: 'Last 7 days' },
    { label: 'Qualified', value: `${qualified}`, delta: 'Active pipeline' },
    { label: 'Pipeline value', value: `£${pipelineValue.toLocaleString()}`, delta: 'Budget maximums' },
  ]
}

export async function getMessageMetrics() {
  const token = await getToken()
  if (!token) return { unread: 0, waiting: 0, open: 0, resolved: 0 }
  const convs = await dashboardWorkspaceApi.conversations(token).catch(() => [])

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const open = convs.filter(c => c.status === 'Open' || c.status === 'Waiting').length
  const unread = convs.reduce((s, c) => s + (c.unread_count || 0), 0)
  const waiting = convs.filter(c => c.status === 'Waiting').length
  const resolved = convs.filter(c => c.resolved_at && new Date(c.resolved_at) >= today).length

  return { unread, waiting, open, resolved }
}

export async function getIntegrationStatus() {
  const token = await getToken()
  if (!token) return { connected: 0, suggested: 0, pending: 0, healthChecks: [] }
  const supportStarted = Date.now()
  const support = await dashboardWorkspaceApi.support(token, 'integrations').catch(() => null)
  const integrations = support?.integrations || []
  const connected = integrations.filter(i => i.status === 'connected' || i.status === 'Configured').length
  const pending = integrations.filter(i => i.status === 'pending').length
  const suggested = Math.max(0, integrations.length - connected - pending)

  const checks: Array<{
    provider: string
    status: 'healthy' | 'degraded' | 'down' | 'unknown'
    latencyMs: number | null
    checkedAt: string
    detail: string
  }> = []
  const nowIso = new Date().toISOString()

  const supabaseLatency = Date.now() - supportStarted
  checks.push({
    provider: 'Supabase',
    status: support ? (supabaseLatency > 900 ? 'degraded' : 'healthy') : 'down',
    latencyMs: supabaseLatency,
    checkedAt: nowIso,
    detail: support ? 'Authenticated Azure API database probe completed successfully.' : 'Authenticated database probe failed.',
  })

  const resendConfigured = Boolean(support?.capabilities?.resend)
  checks.push({
    provider: 'Resend',
    status: resendConfigured ? 'healthy' : 'down',
    latencyMs: null,
    checkedAt: nowIso,
    detail: resendConfigured ? 'Sending is configured in the authenticated Azure API.' : 'Azure API email delivery is not configured.',
  })

  const hubspotStarted = Date.now()
  try {
    await platformServerFetch<{ results: unknown[] }>('/api/v1/integrations/hubspot/contacts?limit=1', {
      accessToken: token,
    })
    checks.push({
      provider: 'HubSpot',
      status: 'healthy',
      latencyMs: Date.now() - hubspotStarted,
      checkedAt: nowIso,
      detail: 'Authenticated HubSpot API probe completed successfully.',
    })
  } catch (error) {
    checks.push({
      provider: 'HubSpot',
      status: 'down',
      latencyMs: Date.now() - hubspotStarted,
      checkedAt: nowIso,
      detail: error instanceof Error ? error.message : 'HubSpot API probe failed.',
    })
  }

  await dashboardWorkspaceApi.saveHealthChecks(token, checks).catch(() => null)
  const history = [
    ...checks,
    ...(support?.healthChecks || []).map((row) => ({
      provider: row.provider || 'Unknown',
      status: (row.status || 'unknown') as 'healthy' | 'degraded' | 'down' | 'unknown',
      latencyMs: row.latency_ms ?? null,
      checkedAt: row.checked_at || nowIso,
      detail: row.detail || 'No detail available.',
    })),
  ]
    .sort((left, right) => new Date(right.checkedAt).getTime() - new Date(left.checkedAt).getTime())
    .slice(0, 6)

  return { connected, suggested, pending, healthChecks: history.length ? history : checks }
}

// ─── TASKS, ACTIVITY, RECOMMENDATIONS, GOALS ─────────────────────────────────

export async function getTasks(): Promise<TaskItem[]> {
  const token = await getToken()
  if (!token) return []
  try {
    const data = await tasksApi.listAll(token, 10)
    return data.map((t) => ({
      id: t.id,
      label: t.title || 'Task',
      time: t.dueDate
        ? new Date(t.dueDate).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'No due date',
      checked: t.isCompleted || false,
    }))
  } catch { return [] }
}

export async function getRecentActivity(): Promise<ActivityItem[]> {
  const token = await getToken()
  if (!token) return []
  try {
    const data = await activityFeedApi.list(token, 10)
    return data.map(e => ({
      title: e.description || e.type || 'Activity',
      time: relativeTime(e.createdAt),
    }))
  } catch { return [] }
}

export async function getRecommendations(): Promise<Recommendation[]> {
  const leads = await getRawLeads()
  return [...leads]
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5)
      .map((lead) => {
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
  const token = await getToken()
  if (!token) return []
  const support = await dashboardWorkspaceApi.support(token, 'goals').catch(() => null)
  return (support?.goals || []).map(g => {
    const current = Number(g.current_value)
    const target = Number(g.target_value)
    return {
      label: g.label,
      current,
      target,
      unit: g.unit as 'count' | 'dollar',
      pct: target > 0 ? Math.round((current / target) * 100) : 0,
    }
  })
}

// ─── LEAD EVENTS (per-lead timeline) ─────────────────────────────────────────

export type LeadEventRow = {
  id: string
  type: string
  note: string | null
  title: string | null
  created_at: string
  metadata: Record<string, unknown> | null
  created_by: string | null
  creator_name: string | null
}

export async function getLeadEvents(leadId: string): Promise<LeadEventRow[]> {
  const token = await getToken()
  if (!token) return []
  try {
    const data = await leadsApi.listEvents(token, leadId)
    return data.map(e => ({
      id: e.id,
      type: e.type,
      note: e.note ?? null,
      title: e.title ?? null,
      created_at: e.createdAt,
      metadata: e.metadata ? (() => { try { return JSON.parse(e.metadata!) } catch { return null } })() : null,
      created_by: e.createdBy ?? null,
      creator_name: null,
    }))
  } catch { return [] }
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

const getAdminStatus = cache(async () => {
  const { supabase, user } = await getAuthContext()
  if (!user) return false
  const email = normalizeEmail(user.email)
  if (isFoundingAdminEmail(email)) return true

  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('user_id', user.id).single()
  if (profile?.role === 'admin') return true

  const { data: licensedUser } = await supabase
    .from('licensed_users')
    .select('role, status')
    .eq('email', email)
    .single()

  return licensedUser?.role === 'admin' && licensedUser?.status === 'active'
})

export async function isAdmin() {
  return getAdminStatus()
}

const getSystemAccess = cache(async () => {
  const { supabase, user } = await getAuthContext()
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
})

export async function canUseSystem() {
  return getSystemAccess()
}

export async function getDashboardAuthorization() {
  const { user } = await getAuthContext()
  return {
    authenticated: Boolean(user),
    isAdmin: user ? await getAdminStatus() : false,
  }
}

export type DashboardAccessProfile = {
  isAdmin: boolean
  canUseSystem: boolean
  modules: {
    overview: boolean
    leads: boolean
    videos: boolean
    emails: boolean
    messages: boolean
    enterprise: boolean
    reports: boolean
    siteRequests: boolean
    integrations: boolean
    settings: boolean
    blog: boolean
  }
}

type PermissionMatrixRow = {
  role?: string
  canManageUsers?: boolean
  canManageBilling?: boolean
  canManageLeads?: boolean
  canManageCampaigns?: boolean
  canViewAudit?: boolean
}

function normalizeMatrixRole(value?: string | null) {
  const role = (value || '').trim().toLowerCase()
  if (!role) return 'Sales'
  if (role === 'admin') return 'Admin'
  if (role === 'viewer') return 'Viewer'
  if (role === 'delivery') return 'Delivery'
  if (role === 'member' || role === 'user' || role === 'sales') return 'Sales'
  return 'Sales'
}

const getDashboardAccessProfileCached = cache(async (): Promise<DashboardAccessProfile> => {
  const { supabase, user } = await getAuthContext()
  const [admin, licensed] = user
    ? await Promise.all([getAdminStatus(), getSystemAccess()])
    : [false, false]
  const fallbackModules = {
    overview: licensed,
    leads: licensed,
    videos: licensed,
    emails: licensed,
    messages: licensed,
    enterprise: admin,
    reports: admin,
    siteRequests: licensed,
    integrations: admin,
    settings: admin,
    blog: admin,
  }
  if (!user || !licensed) {
    return { isAdmin: admin, canUseSystem: licensed, modules: fallbackModules }
  }

  if (admin) {
    return {
      isAdmin: true,
      canUseSystem: true,
      modules: {
        overview: true,
        leads: true,
        videos: true,
        emails: true,
        messages: true,
        enterprise: true,
        reports: true,
        siteRequests: true,
        integrations: true,
        settings: true,
        blog: true,
      },
    }
  }

  const { data: matrixState } = await supabase.from('enterprise_state').select('value').eq('key', 'permission_matrix').single()
  const matrix = Array.isArray(matrixState?.value) ? (matrixState.value as PermissionMatrixRow[]) : []
  const normalizedEmail = normalizeEmail(user.email)
  const [{ data: profile }, { data: licensedUser }] = await Promise.all([
    supabase.from('user_profiles').select('role').eq('user_id', user.id).single(),
    supabase.from('licensed_users').select('role').eq('email', normalizedEmail).single(),
  ])
  const role = normalizeMatrixRole(licensedUser?.role || profile?.role)
  const row = matrix.find((item) => (item.role || '').toLowerCase() === role.toLowerCase())
  if (!row) return { isAdmin: false, canUseSystem: true, modules: fallbackModules }

  return {
    isAdmin: false,
    canUseSystem: true,
    modules: {
      overview: true,
      leads: Boolean(row.canManageLeads),
      videos: Boolean(row.canManageCampaigns || row.canManageLeads),
      emails: Boolean(row.canManageCampaigns),
      messages: Boolean(row.canManageLeads || row.canManageCampaigns),
      enterprise: Boolean(row.canViewAudit),
      reports: Boolean(row.canViewAudit),
      siteRequests: Boolean(row.canManageLeads),
      integrations: Boolean(row.canManageUsers || row.canManageBilling),
      settings: Boolean(row.canManageUsers || row.canManageBilling),
      blog: false,
    },
  }
})

export async function getDashboardAccessProfile(): Promise<DashboardAccessProfile> {
  return getDashboardAccessProfileCached()
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

// ─── POST-LOGIN ROUTING ───────────────────────────────────────────────────────
// Called by the login page after signInWithPassword succeeds.
// Returns the path the user should be redirected to, or null if not allowed.

export async function getPostLoginRedirect(): Promise<'/dashboard' | '/user-dashboard' | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: isAdminResult } = await supabase.rpc('is_admin')
  if (isAdminResult) return '/dashboard'

  const email = normalizeEmail(user.email)
  const { data: licensed } = await supabase
    .from('licensed_users')
    .select('status')
    .eq('email', email)
    .single()

  if (licensed?.status === 'active' || licensed?.status === 'pending') return '/user-dashboard'

  return null
}
