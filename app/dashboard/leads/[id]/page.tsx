import { notFound } from 'next/navigation'
import { getLead, getLeadEvents } from '@/app/actions/dashboard'
import { LeadDetailClient } from './lead-detail-client'

export const metadata = {
  title: 'Lead Detail | Online2Day CRM Dashboard',
  description: 'Lead detail workspace for video, email and activity.',
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [lead, leadEvents] = await Promise.all([getLead(id), getLeadEvents(id)])

  if (!lead) {
    notFound()
  }

  return <LeadDetailClient lead={lead} leadEvents={leadEvents} />
}
