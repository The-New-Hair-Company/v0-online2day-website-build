import { CrmDashboard } from '@/components/crm-dashboard/crm-dashboard'
import { getDashboardAccessProfile, getIntegrationStatus } from '@/app/actions/dashboard'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Integrations | Online2Day CRM Dashboard',
  description: 'Integration management for Online2Day CRM.',
}

export default async function DashboardIntegrationsPage() {
  const access = await getDashboardAccessProfile()
  if (!access.canUseSystem || !access.modules.integrations) {
    redirect('/dashboard/overview')
  }
  const integrationStatus = await getIntegrationStatus()

  return <CrmDashboard section="integrations" integrationStatus={integrationStatus} />
}
