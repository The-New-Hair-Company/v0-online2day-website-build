import { CrmDashboard } from '@/components/crm-dashboard/crm-dashboard'
import { getIntegrationStatus } from '@/app/actions/dashboard'

export const metadata = {
  title: 'Integrations | Online2Day CRM Dashboard',
  description: 'Integration management for Online2Day CRM.',
}

export default async function DashboardIntegrationsPage() {
  const integrationStatus = await getIntegrationStatus()

  return <CrmDashboard section="integrations" integrationStatus={integrationStatus} />
}
