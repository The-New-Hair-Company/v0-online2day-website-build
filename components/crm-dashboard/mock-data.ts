import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  CalendarDays,
  CircleGauge,
  Coins,
  DollarSign,
  Mail,
  MessageSquare,
  MonitorPlay,
  Target,
  UserRoundCheck,
  Users,
  Video,
} from 'lucide-react'
import type {
  ConversationRecord,
  EmailRecord,
  LeadRecord,
  LeadStage,
  MetricItem,
  ProcessStep,
  SiteRequestRecord,
  TableTab,
  VideoRecord,
} from './types'

export const dateRangeLabel = 'May 11 – May 18, 2025'

export const leadStages: Array<'All stages' | LeadStage> = [
  'All stages',
  'New',
  'Contacted',
  'Qualified',
  'Proposal Sent',
  'Negotiation',
  'Won',
]

export const leadMetrics: MetricItem[] = [
  { label: 'Total leads', value: '1,248', delta: '+15.8% vs May 4 – May 11', icon: Users, sparkline: [24, 28, 26, 31, 29, 34, 32, 33, 36, 35, 39, 37] },
  { label: 'New this week', value: '156', delta: '+22.4% vs May 4 – May 11', icon: CalendarDays, sparkline: [10, 16, 20, 18, 15, 16, 17, 18, 19, 21, 23, 28] },
  { label: 'Qualified leads', value: '248', delta: '+18.3% vs May 4 – May 11', icon: UserRoundCheck, sparkline: [16, 19, 21, 20, 18, 17, 20, 22, 21, 23, 20, 26] },
  { label: 'High-intent leads', value: '42', delta: '+31.5% vs May 4 – May 11', icon: Target, sparkline: [7, 8, 11, 10, 14, 13, 12, 16, 15, 17, 14, 19] },
  { label: 'Meetings booked', value: '32', delta: '+33.3% vs May 4 – May 11', icon: CalendarDays, sparkline: [4, 7, 5, 8, 7, 9, 8, 11, 10, 13, 11, 14] },
  { label: 'Avg response rate', value: '26%', delta: '+8.7% vs May 4 – May 11', icon: CircleGauge, sparkline: [19, 21, 20, 23, 22, 24, 23, 26, 25, 27, 26, 29] },
  { label: 'Pipeline value', value: '$1.82M', delta: '+15.7% vs May 4 – May 11', icon: DollarSign, sparkline: [36, 37, 38, 39, 38, 40, 42, 43, 44, 45, 47, 49] },
  { label: 'Revenue influenced', value: '$128K', delta: '+31.6% vs May 4 – May 11', icon: Coins, sparkline: [11, 13, 12, 16, 15, 17, 14, 18, 17, 20, 19, 23] },
]

export const leadProcess: ProcessStep[] = [
  { step: 1, label: 'Capture lead' },
  { step: 2, label: 'Qualify' },
  { step: 3, label: 'Personalise outreach' },
  { step: 4, label: 'Send video' },
  { step: 5, label: 'Handle objections' },
  { step: 6, label: 'Book call' },
  { step: 7, label: 'Close' },
]

export const leadTabs: TableTab[] = [
  { label: 'All leads', count: 248 },
  { label: 'High intent', count: 42 },
  { label: 'Follow-up due', count: 12 },
  { label: 'At risk', count: 8 },
  { label: 'Won', count: 32 },
]

export const leads: LeadRecord[] = [
  { id: 'lead-acme', contactName: 'Sarah Johnson', role: 'Chief Marketing Officer', company: 'Acme Corp.', companyMark: 'ACME', score: 92, stage: 'Qualified', owner: 'Sarah M.', source: 'Website', lastActivity: '2h ago', engagement: 85, value: '$120K', nextAction: 'Send follow-up' },
  { id: 'lead-greentech', contactName: 'Mike Chen', role: 'VP Sales', company: 'GreenTech Solutions', companyMark: 'GT', score: 88, stage: 'Contacted', owner: 'James T.', source: 'Referral', lastActivity: '4h ago', engagement: 80, value: '$95K', nextAction: 'Book meeting' },
  { id: 'lead-beta', contactName: 'Priya Patel', role: 'Head of Operations', company: 'Beta Industries', companyMark: 'B', score: 76, stage: 'Proposal Sent', owner: 'Emily R.', source: 'Cold outreach', lastActivity: '6h ago', engagement: 65, value: '$75K', nextAction: 'Create proposal' },
  { id: 'lead-technova', contactName: 'Daniel Kim', role: 'CTO', company: 'TechNova Systems', companyMark: 'TN', score: 72, stage: 'Qualified', owner: 'Daniel K.', source: 'Website', lastActivity: '1d ago', engagement: 60, value: '$60K', nextAction: 'Nudge reply' },
  { id: 'lead-brightpath', contactName: 'Laura White', role: 'Consulting Director', company: 'BrightPath Consulting', companyMark: 'BP', score: 68, stage: 'New', owner: 'Michael B.', source: 'Ads', lastActivity: '1d ago', engagement: 45, value: '$45K', nextAction: 'Send follow-up' },
  { id: 'lead-cloudpeak', contactName: 'Tom Richards', role: 'IT Manager', company: 'CloudPeak Inc.', companyMark: 'CP', score: 64, stage: 'Contacted', owner: 'Sarah M.', source: 'Organic', lastActivity: '2d ago', engagement: 40, value: '$40K', nextAction: 'Book meeting' },
  { id: 'lead-vertex', contactName: 'Alex Nguyen', role: 'Data Analyst', company: 'Vertex Analytics', companyMark: 'VA', score: 60, stage: 'Negotiation', owner: 'James T.', source: 'Referral', lastActivity: '2d ago', engagement: 70, value: '$110K', nextAction: 'Schedule call' },
]

export const videoMetrics: MetricItem[] = [
  { label: 'Total videos', value: '238', delta: '+14.3% vs Apr 27 – May 4', icon: Video, sparkline: [12, 12, 13, 13, 12, 13, 14, 14, 15, 14, 14, 15] },
  { label: 'Sent this week', value: '56', delta: '+22.2% vs Apr 27 – May 4', icon: MonitorPlay, sparkline: [7, 7, 8, 7, 6, 7, 7, 6, 8, 8, 9, 8] },
  { label: 'Avg watch rate', value: '68%', delta: '+8.6% vs Apr 27 – May 4', icon: Activity, sparkline: [58, 60, 63, 61, 66, 69, 67, 70, 66, 71, 68, 68] },
  { label: 'CTA clicks', value: '24', delta: '+33.3% vs Apr 27 – May 4', icon: Target, sparkline: [6, 5, 7, 7, 8, 7, 8, 7, 8, 6, 7, 8] },
  { label: 'Meetings booked', value: '12', delta: '+20.0% vs Apr 27 – May 4', icon: CalendarDays, sparkline: [3, 3, 2, 3, 4, 4, 3, 4, 5, 3, 4, 4] },
  { label: 'Revenue influenced', value: '$128K', delta: '+31.4% vs Apr 27 – May 4', icon: DollarSign, sparkline: [22, 24, 23, 24, 25, 24, 23, 23, 25, 22, 24, 23] },
]

export const videoProcess: ProcessStep[] = [
  { step: 1, label: 'Create video' },
  { step: 2, label: 'Personalise for lead' },
  { step: 3, label: 'Add CTA' },
  { step: 4, label: 'Share by email / link' },
  { step: 5, label: 'Track engagement' },
  { step: 6, label: 'Trigger follow-up' },
  { step: 7, label: 'Book meeting' },
]

export const videos: VideoRecord[] = [
  { id: 'video-1', title: 'Q2 Marketing Proposal', company: 'Acme Corporation', duration: '02:34', funnelStage: 'Proposal Sent', owner: 'Sarah M.', channel: 'Email', cta: 'Book meeting', status: 'Viewed', watchRate: 84, lastViewed: 'May 17, 2025 10:24 AM', replies: 2, nextAction: 'Send follow-up' },
  { id: 'video-2', title: 'SEO Audit Walkthrough', company: 'BrightPath Co.', duration: '03:12', funnelStage: 'Qualified', owner: 'James T.', channel: 'Link', cta: 'View audit', status: 'High intent', watchRate: 92, lastViewed: 'May 17, 2025 9:11 AM', replies: 1, nextAction: 'Book meeting' },
  { id: 'video-3', title: 'Platform Onboarding', company: 'TechNova Ltd.', duration: '01:46', funnelStage: 'Negotiation', owner: 'Emily R.', channel: 'Email', cta: 'Get started', status: 'Sent', watchRate: 56, lastViewed: 'May 16, 2025 4:32 PM', replies: 0, nextAction: 'Nudge to reply' },
  { id: 'video-4', title: 'Case Study Results', company: 'Growth Labs', duration: '02:05', funnelStage: 'Prospecting', owner: 'Michael B.', channel: 'Link', cta: 'Download case study', status: 'Viewed', watchRate: 71, lastViewed: 'May 16, 2025 11:03 AM', replies: 0, nextAction: 'Add to campaign' },
  { id: 'video-5', title: 'Product Demo Overview', company: 'Nimbus Solutions', duration: '01:30', funnelStage: 'Qualified', owner: 'Jessica L.', channel: 'Email', cta: 'Book demo', status: 'Draft', watchRate: 0, lastViewed: '—', replies: 0, nextAction: 'Finish & send' },
  { id: 'video-6', title: 'Customer Success Story', company: 'Velocity Partners', duration: '02:36', funnelStage: 'Prospecting', owner: 'Daniel K.', channel: 'Link', cta: 'Learn more', status: 'Ready', watchRate: 23, lastViewed: 'May 15, 2025 6:20 PM', replies: 0, nextAction: 'Share via email' },
]

export const emailMetrics: MetricItem[] = [
  { label: 'Emails sent', value: '1,842', delta: '+18.5% vs May 4 – May 10', icon: Mail, sparkline: [42, 44, 43, 46, 47, 45, 48, 46, 47, 46, 49, 50] },
  { label: 'Open rate', value: '46%', delta: '+6.2% vs May 4 – May 10', icon: Target, sparkline: [39, 43, 45, 45, 44, 44, 43, 42, 43, 43, 44, 46] },
  { label: 'Click rate', value: '18%', delta: '+4.1% vs May 4 – May 10', icon: BarChart3, sparkline: [12, 14, 15, 13, 12, 13, 14, 14, 13, 15, 16, 18] },
  { label: 'Reply rate', value: '11%', delta: '+3.7% vs May 4 – May 10', icon: MessageSquare, sparkline: [7, 8, 8, 9, 10, 9, 8, 8, 10, 9, 11, 11] },
  { label: 'Meetings booked', value: '28', delta: '+27.3% vs May 4 – May 10', icon: CalendarDays, sparkline: [6, 7, 7, 8, 8, 7, 9, 9, 10, 11, 11, 12] },
  { label: 'Sequences active', value: '12', delta: '+9.1% vs May 4 – May 10', icon: Activity, sparkline: [3, 4, 4, 5, 5, 4, 4, 5, 6, 5, 6, 6] },
  { label: 'Deliverability', value: '98.1%', delta: '+2.4% vs May 4 – May 10', icon: UserRoundCheck, sparkline: [97, 97, 98, 98, 98, 98, 98, 97, 98, 98, 98, 98] },
  { label: 'Revenue influenced', value: '$146K', delta: '+21.6% vs May 4 – May 10', icon: BadgeDollarSign, sparkline: [26, 27, 29, 30, 29, 31, 30, 31, 33, 35, 34, 36] },
]

export const emailProcess: ProcessStep[] = [
  { step: 1, label: 'Capture lead' },
  { step: 2, label: 'Segment' },
  { step: 3, label: 'Personalise' },
  { step: 4, label: 'Send email' },
  { step: 5, label: 'Track engagement' },
  { step: 6, label: 'Follow-up' },
  { step: 7, label: 'Book meeting' },
]

export const emails: EmailRecord[] = [
  { id: 'email-1', template: 'Initial Outreach', audience: 'SMB Leads', stage: 'Initial outreach', owner: 'Sarah M.', subject: 'Quick intro from Online2Day', sent: 324, opens: 52, replies: 14, cta: 'Book intro call', lastEdited: '2h ago', nextAction: 'Send test' },
  { id: 'email-2', template: 'Video Follow-up', audience: 'Warm Prospects', stage: 'Follow-up', owner: 'James T.', subject: 'A quick personalised video for you', sent: 198, opens: 61, replies: 18, cta: 'Watch video', lastEdited: '4h ago', nextAction: 'Review performance' },
  { id: 'email-3', template: 'Proposal Sent', audience: 'Qualified Leads', stage: 'Proposal', owner: 'Emily R.', subject: 'Your proposal from Online2Day', sent: 84, opens: 69, replies: 21, cta: 'Review proposal', lastEdited: '6h ago', nextAction: 'Send follow-up' },
  { id: 'email-4', template: 'Chase-up 1', audience: 'No Reply 3 Days', stage: 'Follow-up', owner: 'Daniel K.', subject: 'Just checking in', sent: 276, opens: 41, replies: 9, cta: 'Reply now', lastEdited: '1d ago', nextAction: 'Create variant' },
  { id: 'email-5', template: 'Chase-up 2', audience: 'No Reply 7 Days', stage: 'Re-engagement', owner: 'Sarah M.', subject: 'Worth a final follow-up?', sent: 122, opens: 33, replies: 6, cta: 'Book meeting', lastEdited: '2d ago', nextAction: 'Pair with video' },
  { id: 'email-6', template: 'Won', audience: 'Closed Won', stage: 'Closed won/lost', owner: 'Michael B.', subject: 'Great working with you', sent: 38, opens: 72, replies: 27, cta: 'Refer a friend', lastEdited: '3d ago', nextAction: 'Launch campaign' },
]

export const messageMetrics: MetricItem[] = [
  { label: 'Open conversations', value: '48', delta: '+20% vs May 4 – May 10', icon: MessageSquare, sparkline: [18, 18, 20, 19, 21, 22, 21, 23, 22, 24, 25, 26] },
  { label: 'Unread messages', value: '12', delta: '+9% vs May 4 – May 10', icon: Mail, sparkline: [6, 8, 7, 10, 9, 8, 9, 11, 10, 12, 11, 12] },
  { label: 'Avg first response', value: '3m 42s', delta: '+18% vs May 4 – May 10', icon: Activity, sparkline: [5, 4, 5, 4, 3, 3, 4, 4, 3, 4, 3, 3] },
  { label: 'Qualified chats', value: '26', delta: '+30.5% vs May 4 – May 10', icon: UserRoundCheck, sparkline: [8, 9, 8, 10, 11, 11, 10, 12, 11, 13, 12, 14] },
  { label: 'Meetings booked', value: '9', delta: '+29% vs May 4 – May 10', icon: CalendarDays, sparkline: [2, 2, 3, 3, 4, 4, 3, 4, 5, 4, 5, 5] },
  { label: 'CSAT', value: '96%', delta: '+4% vs May 4 – May 10', icon: Target, sparkline: [91, 92, 93, 94, 93, 94, 95, 95, 95, 96, 96, 96] },
  { label: 'High-intent leads', value: '14', delta: '+27% vs May 4 – May 10', icon: Users, sparkline: [4, 4, 5, 5, 7, 6, 7, 8, 9, 10, 12, 14] },
  { label: 'Revenue influenced', value: '$84K', delta: '+32% vs May 4 – May 10', icon: DollarSign, sparkline: [18, 20, 19, 22, 24, 24, 25, 27, 28, 30, 32, 34] },
]

export const messageProcess: ProcessStep[] = [
  { step: 1, label: 'Capture message' },
  { step: 2, label: 'Qualify intent' },
  { step: 3, label: 'Personalise response' },
  { step: 4, label: 'Share proof' },
  { step: 5, label: 'Handle objections' },
  { step: 6, label: 'Book meeting' },
  { step: 7, label: 'Close' },
]

export const conversations: ConversationRecord[] = [
  {
    id: 'conv-sarah',
    name: 'Sarah Johnson',
    company: 'Acme Corp',
    preview: 'Can you walk me through ROI other companies have seen?',
    time: '10m ago',
    priority: 'High',
    score: 92,
    channel: 'WhatsApp',
    status: 'Waiting',
    unread: 2,
    messages: [
      { id: 'm1', sender: 'client', text: 'Thanks for the pricing overview! Can you walk me through the ROI other companies have seen with Online2Day?', time: '10:21 AM' },
      { id: 'm2', sender: 'agent', text: 'Absolutely! On average, our customers see a 3x ROI within 6 months. Here’s a quick case study you might find helpful.', time: '10:22 AM', attachmentLabel: 'Acme ROI Case Study.pdf', meta: '1.2 MB • PDF' },
      { id: 'm3', sender: 'client', text: 'That’s impressive. Do you have a quick video that shows how it works in action?', time: '10:24 AM' },
      { id: 'm4', sender: 'agent', text: 'Personalised demo for Acme Corp. See how Online2Day can help Acme Corp increase engagement and drive 3x more qualified leads.', time: '10:26 AM', meta: 'Watched 84%' },
      { id: 'm5', sender: 'note', text: 'Sarah is evaluating for Q3 rollout. High budget authority and urgent need. Focus on ROI and onboarding support.', time: '10:27 AM' },
    ],
  },
  {
    id: 'conv-michael',
    name: 'Michael Chen',
    company: 'TechNova Inc',
    preview: 'Can we schedule a demo for next Tuesday?',
    time: '15m ago',
    priority: 'Medium',
    score: 78,
    channel: 'Web',
    status: 'Open',
    messages: [{ id: 'm6', sender: 'client', text: 'Can we schedule a demo for next Tuesday?', time: '10:14 AM' }],
  },
  {
    id: 'conv-emma',
    name: 'Emma Davis',
    company: 'BrightSide Co',
    preview: 'Great video demo! What integrations do you support?',
    time: '25m ago',
    priority: 'Medium',
    score: 74,
    channel: 'Email',
    status: 'Open',
    unread: 1,
    messages: [{ id: 'm7', sender: 'client', text: 'Great video demo! What integrations do you support?', time: '9:59 AM' }],
  },
  { id: 'conv-david', name: 'David Wilson', company: 'Global Logistics', preview: 'Looking for enterprise pricing details.', time: '1h ago', priority: 'High', score: 88, channel: 'WhatsApp', status: 'Open', messages: [] },
  { id: 'conv-priya', name: 'Priya Patel', company: 'HealthPlus', preview: 'Do you offer onboarding support?', time: '2h ago', priority: 'Low', score: 61, channel: 'Email', status: 'Resolved', messages: [] },
  { id: 'conv-james', name: 'James Lee', company: 'Innovatex', preview: 'Interested in the annual plan discount.', time: '3h ago', priority: 'Medium', score: 67, channel: 'Web', status: 'Open', messages: [] },
  { id: 'conv-sophie', name: 'Sophie Martin', company: 'NextGen Solutions', preview: 'We might need a custom integration.', time: '4h ago', priority: 'Low', score: 59, channel: 'WhatsApp', status: 'Open', messages: [] },
]

export const siteRequestMetrics: MetricItem[] = [
  { label: 'Open requests', value: '36', delta: '+20% vs May 4 – May 10', icon: Users, sparkline: [12, 14, 13, 15, 14, 15, 16, 15, 17, 18, 18, 19] },
  { label: 'New this week', value: '12', delta: '+14% vs May 4 – May 10', icon: CalendarDays, sparkline: [2, 3, 3, 4, 3, 4, 5, 4, 4, 5, 6, 5] },
  { label: 'Qualified projects', value: '18', delta: '+29% vs May 4 – May 10', icon: UserRoundCheck, sparkline: [5, 6, 6, 7, 8, 8, 7, 9, 10, 11, 12, 12] },
  { label: 'Discovery booked', value: '9', delta: '+13% vs May 4 – May 10', icon: CalendarDays, sparkline: [2, 2, 3, 3, 4, 4, 3, 4, 4, 5, 5, 5] },
  { label: 'Proposal sent', value: '7', delta: '+17% vs May 4 – May 10', icon: Mail, sparkline: [1, 2, 2, 2, 3, 3, 2, 4, 4, 4, 5, 5] },
  { label: 'Avg turnaround', value: '2.4d', delta: '+8% vs May 4 – May 10', icon: Activity, sparkline: [4, 4, 3, 3, 3, 2, 3, 2, 2, 2, 2, 2] },
  { label: 'Pipeline value', value: '$214K', delta: '+18% vs May 4 – May 10', icon: DollarSign, sparkline: [24, 25, 26, 26, 28, 29, 31, 32, 34, 35, 36, 37] },
  { label: 'Revenue influenced', value: '$96K', delta: '+21% vs May 4 – May 10', icon: Coins, sparkline: [18, 18, 20, 20, 21, 22, 23, 24, 24, 25, 26, 28] },
]

export const siteRequestProcess: ProcessStep[] = [
  { step: 1, label: 'Request submitted' },
  { step: 2, label: 'Qualify' },
  { step: 3, label: 'Discovery' },
  { step: 4, label: 'Scope & quote' },
  { step: 5, label: 'Build' },
  { step: 6, label: 'QA & approve' },
  { step: 7, label: 'Launch' },
]

export const siteRequests: SiteRequestRecord[] = [
  { id: 'req-1', request: 'CRM Website Rebuild', company: 'Acme Corp', type: 'Website', priority: 'High', stage: 'Qualified', owner: 'Sarah M.', lastActivity: '35m ago', value: '$28K', nextAction: 'Create proposal' },
  { id: 'req-2', request: 'Client Portal MVP', company: 'GreenTech Solutions', type: 'Web app', priority: 'High', stage: 'Discovery', owner: 'James T.', lastActivity: '1h ago', value: '$65K', nextAction: 'Prepare scope' },
  { id: 'req-3', request: 'Landing Page Refresh', company: 'BrightSide Co', type: 'Landing page', priority: 'Medium', stage: 'Scoping', owner: 'Emily R.', lastActivity: '2h ago', value: '$8K', nextAction: 'Send estimate' },
  { id: 'req-4', request: 'Membership Platform', company: 'HealthPlus', type: 'Web app', priority: 'High', stage: 'In Build', owner: 'Emily R.', lastActivity: '2h ago', value: '$72K', nextAction: 'Review progress' },
  { id: 'req-5', request: 'Ecommerce Redesign', company: 'Vertex Retail', type: 'Ecommerce', priority: 'Medium', stage: 'QA', owner: 'Michael B.', lastActivity: '3h ago', value: '$34K', nextAction: 'Approve QA' },
  { id: 'req-6', request: 'Brochure Site', company: 'Nimbus Legal', type: 'Website', priority: 'Low', stage: 'Approval', owner: 'Sarah M.', lastActivity: '6h ago', value: '$12K', nextAction: 'Chase feedback' },
  { id: 'req-7', request: 'SEO Microsite', company: 'CloudPeak Inc.', type: 'Microsite', priority: 'Medium', stage: 'Launched', owner: 'James T.', lastActivity: '1d ago', value: '$6K', nextAction: 'Upsell support' },
]
