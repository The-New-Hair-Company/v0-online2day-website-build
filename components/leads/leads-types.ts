export type Metric = {
  label: string
  value: string
  delta: string
  icon: IconName
  sparkline: number[]
}

export type IconName =
  | 'grid'
  | 'users'
  | 'video'
  | 'mail'
  | 'message'
  | 'request'
  | 'integrations'
  | 'logout'
  | 'calendar'
  | 'filter'
  | 'export'
  | 'plus'
  | 'search'
  | 'dollar'
  | 'trend'
  | 'diamond'
  | 'star'
  | 'task'
  | 'upload'
  | 'owner'
  | 'globe'
  | 'phone'
  | 'linkedin'
  | 'ellipsis'
  | 'chevron'
  | 'external'
  | 'sparkle'
  | 'check'
  | 'clock'
  | 'columns'
  | 'crown'

export type LeadStage = 'New' | 'Contacted' | 'Qualified' | 'Proposal Sent' | 'Negotiation' | 'Won'
export type LeadSource = 'Website' | 'Referral' | 'Cold outreach' | 'Ads' | 'Organic'
export type OwnerName = 'Sarah M.' | 'James T.' | 'Emily R.' | 'Daniel K.' | 'Michael B.'

export type Lead = {
  id: string
  contactName: string
  role: string
  company: string
  companyMark: string
  logoClass: string
  score: number
  stage: LeadStage
  owner: string
  source: LeadSource
  sourceIcon: IconName
  lastActivity: string
  engagement: number
  value: string
  nextAction: string
  selected?: boolean
}

export type PipelineStage = {
  label: LeadStage
  count: number
  percentage: number
  color: string
}

export type LeadSourcePerformance = {
  source: LeadSource
  leads: number
  conversion: string
  value: string
  bar: number
  color: string
}

export type OwnerPerformance = {
  owner: string
  leads: number
  response: string
  meetings: number
  revenue: string
  avatar: string
}

export type TaskItem = {
  label: string
  time: string
  checked?: boolean
}

export type Recommendation = {
  title: string
  detail: string
  action: string
  icon: IconName
  tone: 'purple' | 'red' | 'yellow' | 'blue'
}

export type ActivityItem = {
  title: string
  time: string
}
