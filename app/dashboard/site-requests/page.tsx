import { CrmDashboard } from '@/components/crm-dashboard/crm-dashboard'

export const metadata = {
  title: 'Site Requests | Online2Day CRM Dashboard',
  description: 'Website and app request pipeline for Online2Day.',
}

export default function DashboardSiteRequestsPage() {
  return <CrmDashboard section="site-requests" />
}
