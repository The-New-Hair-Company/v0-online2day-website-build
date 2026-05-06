import { CrmDashboard } from '@/components/crm-dashboard/crm-dashboard'
import { getConversations, getDashboardAccessProfile, getMessageMetrics } from '@/app/actions/dashboard'
import { redirect } from 'next/navigation'

export default async function MessagesPage() {
  const access = await getDashboardAccessProfile()
  if (!access.canUseSystem || !access.modules.messages) {
    redirect('/dashboard/overview?restricted=1')
  }

  const [initialConversations, messageStats] = await Promise.all([
    getConversations(),
    getMessageMetrics(),
  ])

  return <CrmDashboard section="messages" initialConversations={initialConversations} messageStats={messageStats} />
}
