import { notFound } from 'next/navigation'
import { getLeads, getRecentActivity } from '@/app/actions/dashboard'
import { LeadDetailClient } from './lead-detail-client'

export const metadata = {
  title: 'Lead Detail | Online2Day CRM Dashboard',
  description: 'Lead detail workspace for video, email and activity.',
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [leads, recentActivity] = await Promise.all([getLeads(), getRecentActivity()])
  const lead = leads.find((item) => item.id === id)

  if (!lead) {
    notFound()
  }

  return <LeadDetailClient lead={lead} recentActivity={recentActivity} />
}
