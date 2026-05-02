import { CrmDashboard } from '@/components/crm-dashboard/crm-dashboard'
import { getConversations, getMessageMetrics } from '@/app/actions/dashboard'

export default async function MessagesPage() {
  const [initialConversations, messageStats] = await Promise.all([
    getConversations(),
    getMessageMetrics(),
  ])

  return <CrmDashboard section="messages" initialConversations={initialConversations} messageStats={messageStats} />
}
