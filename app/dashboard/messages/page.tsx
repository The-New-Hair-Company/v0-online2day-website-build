import { CrmDashboard } from '@/components/crm-dashboard/crm-dashboard'

export const metadata = {
  title: 'Messages | Online2Day CRM Dashboard',
  description: 'Conversation workspace for Online2Day.',
}

export default function DashboardMessagesPage() {
  return <CrmDashboard section="messages" />
}
