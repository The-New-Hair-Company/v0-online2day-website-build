import { CrmDashboard } from '@/components/crm-dashboard/crm-dashboard'
import { getConversations } from '@/app/actions/dashboard'

export default async function MessagesPage() {
  const initialConversations = await getConversations()
  
  return <CrmDashboard section="messages" initialConversations={initialConversations} />
}
