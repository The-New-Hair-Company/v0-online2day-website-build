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
}

export type EmailRecord = {
  id: string
  template: string
  audience: string
  stage: string
  owner: string
  subject: string
  sent: number
  opens: number
  replies: number
  cta: string
  lastEdited: string
  nextAction: string
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
  leadId: string
  name: string
  slug: string
  createdAt: string
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
  request: string
  company: string
  type: string
  priority: 'High' | 'Medium' | 'Low'
  stage: string
  owner: string
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
}

export interface CrmDashboardProps {
  section: DashboardSection
  initialLeads?: LeadRecord[]
  initialVideos?: VideoRecord[]
  initialEmails?: EmailRecord[]
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
}
