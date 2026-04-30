import { CrmDashboard } from '@/components/crm-dashboard/crm-dashboard'

export const metadata = {
  title: 'Emails | Online2Day CRM Dashboard',
  description: 'Email performance and campaign workspace for Online2Day.',
}

export default function DashboardEmailsPage() {
  return <CrmDashboard section="emails" />
}
