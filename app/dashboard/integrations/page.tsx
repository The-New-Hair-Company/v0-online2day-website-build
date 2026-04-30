import { CrmDashboard } from '@/components/crm-dashboard/crm-dashboard'

export const metadata = {
  title: 'Integrations | Online2Day CRM Dashboard',
  description: 'Integration management for Online2Day CRM.',
}

export default function DashboardIntegrationsPage() {
  return <CrmDashboard section="integrations" />
}
