'use server'

import { createClient } from '@/lib/supabase/server'
import { Database } from '@/lib/supabase/database.types'

import { Lead, LeadStage, IconName, OwnerName, PipelineStage, LeadSourcePerformance, OwnerPerformance, Metric, TaskItem, ActivityItem, Recommendation } from '@/components/leads/leads-types'
import { LeadRecord, VideoRecord, EmailRecord, ConversationRecord, SiteRequestRecord } from '@/components/crm-dashboard/types'

type LeadRow = Database['public']['Tables']['leads']['Row']
type MessageRow = Database['public']['Tables']['messages']['Row']
type EmailRow = Database['public']['Tables']['emails']['Row']
type SiteRequestRow = Database['public']['Tables']['site_build_requests']['Row']
type ProfileRow = Database['public']['Tables']['user_profiles']['Row']

function mapLeadRowToLead(row: LeadRow): Lead {
  const ownerName = (row as any).owner?.full_name || 'Unassigned'
  // Format to "First L." format
  const formattedOwner = ownerName.split(' ').map((part: string, index: number) => 
    index === 0 ? part : part.charAt(0) + '.'
  ).join(' ')
  
  return {
    id: row.id,
    contactName: row.name || 'Unknown',
    role: row.role || 'Contact',
    company: row.company || 'Private',
    companyMark: (row.company || 'P').substring(0, 2).toUpperCase(),
    logoClass: 'logoGeneric', // Default class
    score: row.score || 0,
    stage: (row.status as LeadStage) || 'New',
    owner: formattedOwner,
    source: (row.source as any) || 'Website',
    sourceIcon: 'globe', // Default icon
    lastActivity: row.last_contacted_at ? new Date(row.last_contacted_at).toLocaleDateString() : 'Never',
    engagement: row.engagement || 0,
    value: row.value ? `$${row.value.toLocaleString()}` : '$0',
    nextAction: row.next_action || 'Follow up',
  }
}

function mapRowToLeadRecord(row: LeadRow): LeadRecord {
  return {
    id: row.id,
    contactName: row.name || 'Unknown',
    role: row.role || 'Contact',
    company: row.company || 'Private',
    companyMark: (row.company || 'P').substring(0, 2).toUpperCase(),
    score: row.score || 0,
    stage: (row.status as LeadStage) || 'New',
    owner: row.assigned_to || 'Unassigned',
    source: row.source || 'Website',
    lastActivity: row.last_contacted_at ? new Date(row.last_contacted_at).toLocaleDateString() : 'Never',
    engagement: row.engagement || 0,
    value: row.value ? `$${row.value.toLocaleString()}` : '$0',
    nextAction: row.next_action || 'Follow up',
  }
}

function mapRowToEmailRecord(row: any): EmailRecord {
  return {
    id: row.id,
    template: row.subject || 'Standard Template',
    audience: row.lead?.company || 'All Leads',
    stage: row.status || 'Sent',
    owner: 'Sarah M.',
    subject: row.subject || '(No Subject)',
    sent: 1,
    opens: row.opened_at ? 1 : 0,
    replies: 0,
    cta: 'View details',
    lastEdited: row.sent_at ? new Date(row.sent_at).toLocaleDateString() : 'Just now',
    nextAction: 'Review response',
  }
}

function mapRowToSiteRequestRecord(row: any): SiteRequestRecord {
  return {
    id: row.id,
    request: row.project_name || 'New Site Build',
    company: row.company_name || 'Prospect',
    type: row.site_type || 'Website',
    priority: (row.priority as 'High' | 'Medium' | 'Low') || 'Medium',
    stage: row.status || 'New',
    owner: row.user?.full_name || 'Unassigned',
    lastActivity: row.created_at ? new Date(row.created_at).toLocaleDateString() : 'Just now',
    value: '$0',
    nextAction: 'Qualify',
  }
}

function mapRowToVideoRecord(row: any): VideoRecord {
  return {
    id: row.id,
    title: row.name || 'Untitled Video',
    company: row.lead?.company || 'Prospect',
    duration: row.metadata?.duration || '00:00',
    funnelStage: row.lead?.status || 'New',
    owner: 'Sarah M.',
    channel: 'Email',
    cta: row.metadata?.cta_label || 'Watch Video',
    status: row.view_count > 0 ? 'Viewed' : 'Sent',
    watchRate: row.metadata?.watch_rate || 0,
    lastViewed: row.created_at ? new Date(row.created_at).toLocaleDateString() : 'Never',
    replies: 0,
    nextAction: 'Follow up',
  }
}

export async function getLeads() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('leads')
    .select(`
      *,
      owner:assigned_to(full_name)
    `)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching leads:', error)
    return []
  }
  
  return data.map(mapLeadRowToLead)
}

export async function getLeadRecords(): Promise<LeadRecord[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching lead records:', error)
    return []
  }

  return data.map(mapRowToLeadRecord)
}

export async function getConversations() {
  const supabase = await createClient()
  
  // Fetch unique conversations by user_id
  const { data, error } = await supabase
    .from('messages')
    .select('*, sender:sender_id(email, full_name, avatar_url)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching messages:', error)
    return []
  }

  // Group by conversation_user_id to get conversations
  const conversationsMap = new Map()
  data.forEach((msg) => {
    if (!conversationsMap.has(msg.conversation_user_id)) {
      conversationsMap.set(msg.conversation_user_id, {
        userId: msg.conversation_user_id,
        lastMessage: msg,
        messages: []
      })
    }
    conversationsMap.get(msg.conversation_user_id).messages.push(msg)
  })

  return Array.from(conversationsMap.values()).map(conv => ({
    id: conv.userId,
    name: (conv.lastMessage as any).sender?.full_name || 'Unknown User',
    company: 'Prospect', // Default
    preview: (conv.lastMessage as any).content?.substring(0, 50) || '',
    time: (conv.lastMessage as any).created_at ? new Date((conv.lastMessage as any).created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
    priority: 'Medium', // Default
    score: 0,
    channel: 'Direct',
    status: 'Open',
    messages: conv.messages.map((m: any) => ({
      id: m.id,
      sender: m.sender_id === conv.userId ? 'client' : 'agent',
      text: m.content || '',
      time: m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
    }))
  })) as ConversationRecord[]
}

export async function getEmails() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('emails')
    .select('*, lead:lead_id(name, company)')
    .order('sent_at', { ascending: false })

  if (error) {
    console.error('Error fetching emails:', error)
    return []
  }

  return data.map(mapRowToEmailRecord)
}

export async function getVideos(): Promise<VideoRecord[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lead_assets')
    .select('*, lead:lead_id(company, status)')
    .eq('type', 'video')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching videos:', error)
    return []
  }

  return data.map(mapRowToVideoRecord)
}

export async function getSiteRequests() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('site_build_requests')
    .select('*, user:user_id(email, full_name)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching site requests:', error)
    return []
  }

  return data.map(mapRowToSiteRequestRecord)
}

export async function getDashboardMetrics() {
  const supabase = await createClient()
  
  // Fetch from dashboard_metrics view
  const { data: metrics, error: metricsError } = await supabase
    .from('dashboard_metrics')
    .select('*')
    .single()
  
  if (metricsError) {
    console.error('Error fetching dashboard metrics:', metricsError)
  }
  
  // Fetch from lead_pipeline_summary view for pipeline stages
  const { data: pipeline, error: pipelineError } = await supabase
    .from('lead_pipeline_summary')
    .select('*')
    
  if (pipelineError) {
    console.error('Error fetching pipeline summary:', pipelineError)
  }
  
  // Fetch from lead_source_performance view
  const { data: sources, error: sourcesError } = await supabase
    .from('lead_source_performance')
    .select('*')
    
  if (sourcesError) {
    console.error('Error fetching source performance:', sourcesError)
  }
  
  // Fetch from owner_lead_performance view
  const { data: owners, error: ownersError } = await supabase
    .from('owner_lead_performance')
    .select('*')
    
  if (ownersError) {
    console.error('Error fetching owner performance:', ownersError)
  }
  
  // Transform to Metric[] type
  const pipelineStages: PipelineStage[] = (pipeline || []).map((stage: any) => ({
    label: stage.stage as LeadStage,
    count: stage.count || 0,
    percentage: Math.round((stage.count / (metrics?.total_leads || 1)) * 100),
    color: getStageColor(stage.stage)
  }))
  
  const sourcePerformance: LeadSourcePerformance[] = (sources || []).map((source: any) => ({
    source: source.source as LeadSource,
    leads: source.leads || 0,
    conversion: `${Math.round((source.leads / (metrics?.total_leads || 1)) * 100)}%`,
    value: `$${Number(source.total_value || 0).toLocaleString()}`,
    bar: Math.round((source.leads / (metrics?.total_leads || 1)) * 100),
    color: getSourceColor(source.source)
  }))
  
  const ownerPerformance: OwnerPerformance[] = (owners || []).map((owner: any) => ({
    owner: owner.owner || 'Unknown',
    leads: owner.leads || 0,
    response: '25%', // Default response rate
    meetings: owner.won || 0,
    revenue: `$${Number(owner.total_value || 0).toLocaleString()}`,
    avatar: owner.email?.substring(0, 2).toUpperCase() || 'UN'
  }))
  
  const metricsArray: Metric[] = [
    { label: 'Total leads', value: `${metrics?.total_leads || 0}`, delta: '+0%', icon: 'users', sparkline: [] },
    { label: 'New this week', value: `${metrics?.new_leads || 0}`, delta: '+0%', icon: 'calendar', sparkline: [] },
    { label: 'Qualified leads', value: `${metrics?.qualified_leads || 0}`, delta: '+0%', icon: 'diamond', sparkline: [] },
    { label: 'High-intent leads', value: `${metrics?.high_intent_leads || 0}`, delta: '+0%', icon: 'users', sparkline: [] },
    { label: 'Meetings booked', value: `${metrics?.won_leads || 0}`, delta: '+0%', icon: 'calendar', sparkline: [] },
    { label: 'Avg response rate', value: '26%', delta: '+0%', icon: 'trend', sparkline: [] },
    { label: 'Pipeline value', value: `$${Number(metrics?.pipeline_value || 0).toLocaleString()}`, delta: '+0%', icon: 'dollar', sparkline: [] },
    { label: 'Revenue influenced', value: `$${Number(metrics?.pipeline_value || 0).toLocaleString()}`, delta: '+0%', icon: 'sparkle', sparkline: [] },
  ]
  
  return {
    metrics: metricsArray,
    pipelineStages,
    sourcePerformance,
    ownerPerformance,
    totalLeads: metrics?.total_leads || 0,
  }
}

function getStageColor(stage: string): string {
  const colors: Record<string, string> = {
    'New': '#2f6bff',
    'Contacted': '#19a9ff',
    'Qualified': '#10d184',
    'Proposal Sent': '#8c5cff',
    'Negotiation': '#ff9b2f',
    'Won': '#f6c445',
  }
  return colors[stage] || '#2f6bff'
}

function getSourceColor(source: string): string {
  const colors: Record<string, string> = {
    'Website': '#2f6bff',
    'Referral': '#17d7c1',
    'Cold outreach': '#8c5cff',
    'Ads': '#ff9b2f',
    'Organic': '#22c55e',
  }
  return colors[source] || '#2f6bff'
}

export async function getTasks(): Promise<TaskItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lead_tasks')
    .select('*')
    .order('due_at', { ascending: true })
  
  if (error) {
    console.error('Error fetching tasks:', error)
    return []
  }
  
  return (data || []).map((task: any) => ({
    label: task.title || 'Untitled Task',
    time: task.due_at ? new Date(task.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No due date',
    checked: task.is_done || false,
  }))
}

export async function getRecentActivity(): Promise<ActivityItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lead_events')
    .select('*, lead:lead_id(company)')
    .order('created_at', { ascending: false })
    .limit(10)
  
  if (error) {
    console.error('Error fetching recent activity:', error)
    return []
  }
  
  return (data || []).map((event: any) => ({
    title: `${event.type || 'Activity'}: ${event.lead?.company || 'Unknown'} - ${event.title || event.note || ''}`,
    time: event.created_at ? new Date(event.created_at).toLocaleString() : 'Just now',
  }))
}

export async function getRecommendations(): Promise<Recommendation[]> {
  const supabase = await createClient()
  const { data: leads, error } = await supabase
    .from('leads')
    .select('*')
    .order('score', { ascending: false })
    .limit(5)
  
  if (error || !leads) {
    console.error('Error fetching leads for recommendations:', error)
    return []
  }
  
  return leads.map((lead: any) => {
    const score = lead.score || 0
    const engagement = lead.engagement || 0
    
    if (score >= 80) {
      return {
        title: `Follow up with ${lead.name}`,
        detail: `High engagement +${score}% in recent activity`,
        action: 'Follow up',
        icon: 'sparkle' as IconName,
        tone: 'purple' as const,
      }
    } else if (engagement < 50) {
      return {
        title: `Nudge ${lead.name}`,
        detail: `Low engagement (${engagement}%) - needs attention`,
        action: 'Nudge',
        icon: 'clock' as IconName,
        tone: 'yellow' as const,
      }
    } else {
      return {
        title: `Create video for ${lead.company}`,
        detail: `Good prospect - ${score}% score`,
        action: 'Create video',
        icon: 'video' as IconName,
        tone: 'blue' as const,
      }
    }
  })
}

export async function isAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return false

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  return profile?.role === 'admin'
}
