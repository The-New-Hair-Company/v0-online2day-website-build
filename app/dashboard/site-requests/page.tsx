import { CrmDashboard } from '@/components/crm-dashboard/crm-dashboard'
import { getSiteRequests, getSiteRequestMetrics } from '@/app/actions/dashboard'

export default async function SiteRequestsPage() {
  const [initialSiteRequests, siteRequestMetrics] = await Promise.all([
    getSiteRequests(),
    getSiteRequestMetrics(),
  ])

  return <CrmDashboard section="site-requests" initialSiteRequests={initialSiteRequests} siteRequestMetrics={siteRequestMetrics} />
}
