import type { LucideIcon } from 'lucide-react'

export type DashboardSection =
  | 'overview'
  | 'leads'
  | 'videos'
  | 'emails'
  | 'messages'
  | 'site-requests'
  | 'integrations'

export type MetricItem = {
  label: string
  value: string
  delta: string
  icon: LucideIcon
  sparkline: number[]
}

export type ProcessStep = {
  step: number
  label: string
  detail?: string
}

export type TableTab = {
  label: string
  count?: number
}

export type LeadStage = 'New' | 'Contacted' | 'Qualified' | 'Proposal Sent' | 'Negotiation' | 'Won'

export type LeadRecord = {
  id: string
  contactName: string
  role: string
  company: string
  companyMark: string
  score: number
  stage: LeadStage
  owner: string
  source: string
  lastActivity: string
  engagement: number
  value: string
  nextAction: string
}

export type VideoRecord = {
  id: string
  leadId: string | null
  slug: string
  title: string
  company: string
  duration: string
  funnelStage: string
  owner: string
  channel: string
  cta: string
  status: string
  watchRate: number
  lastViewed: string
  replies: number
  nextAction: string
  createdAt: string
  viewCount: number
  hasMedia: boolean
}

export type EmailRecord = {
  id: string
  template: string
  body: string
  category: string
  audience: string
  stage: string
  owner: string
  subject: string
  sent: number
  opens: number
  clicks: number
  replies: number
  meetings: number
  cta: string
  lastEdited: string
  nextAction: string
}

export type EmailSendRecord = {
  id: string
  leadId: string | null
  recipientName: string
  recipientEmail: string
  company: string
  templateName: string
  subject: string
  status: string
  sentAt: string
  openedAt: string | null
  clickedAt: string | null
}

export type EmailComposerLead = {
  id: string
  name: string
  company: string
  email: string
  status: string
}

export type EmailComposerVideo = {
  id: string
  leadId: string | null
  name: string
  slug: string
  createdAt: string
  storagePath: string
  previewUrl: string
  metadata: Record<string, unknown> | null
}

export type ConversationRecord = {
  id: string
  name: string
  company: string
  preview: string
  time: string
  priority: 'High' | 'Medium' | 'Low'
  score: number
  channel: string
  status: string
  unread?: number
  messages: Array<{
    id: string
    sender: 'client' | 'agent' | 'note'
    text: string
    time: string
    attachmentLabel?: string
    meta?: string
  }>
}

export type SiteRequestRecord = {
  id: string
  leadId: string | null
  request: string
  company: string
  type: string
  priority: 'High' | 'Medium' | 'Low'
  stage: string
  owner: string
  contactEmail: string
  description: string
  timelineWeeks: number
  lastActivity: string
  value: string
  nextAction: string
}

export type SidePanelItem = {
  title: string
  subtitle?: string
  action?: string
}

export type RawMetric = {
  label: string
  value: string
  delta: string
}

export type IntegrationStatus = {
  connected: number
  suggested: number
  pending: number
  healthChecks?: Array<{
    provider: string
    status: 'healthy' | 'degraded' | 'down' | 'unknown'
    latencyMs: number | null
    checkedAt: string
    detail: string
  }>
}

export type CrmSetupConfig = {
  companyName: string
  defaultSenderName: string
  defaultSenderEmail: string
  bookingUrl: string
  defaultCtaLabel: string
  defaultCtaUrl: string
  timezone: string
  followupHours: string
  hotLeadScore: string
  pipelineStages: string
}

export interface CrmDashboardProps {
  section: DashboardSection
  initialLeads?: LeadRecord[]
  initialVideos?: VideoRecord[]
  initialEmails?: EmailRecord[]
  recentEmailSends?: EmailSendRecord[]
  emailComposerData?: {
    leads: EmailComposerLead[]
    videos: EmailComposerVideo[]
  }
  initialConversations?: ConversationRecord[]
  initialSiteRequests?: SiteRequestRecord[]
  leadMetrics?: RawMetric[]
  videoMetrics?: RawMetric[]
  emailMetrics?: RawMetric[]
  siteRequestMetrics?: RawMetric[]
  messageStats?: { unread: number; waiting: number; open: number; resolved: number }
  integrationStatus?: IntegrationStatus
  setupConfig?: CrmSetupConfig
}
