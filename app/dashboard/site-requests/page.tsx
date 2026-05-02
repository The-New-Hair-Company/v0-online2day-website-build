import { CrmDashboard } from '@/components/crm-dashboard/crm-dashboard'
import { getSiteRequests } from '@/app/actions/dashboard'

export default async function SiteRequestsPage() {
  const initialSiteRequests = await getSiteRequests()
  
  return <CrmDashboard section="site-requests" initialSiteRequests={initialSiteRequests} />
}
