import { CrmDashboard } from '@/components/crm-dashboard/crm-dashboard'
import { getEmails, getEmailMetrics } from '@/app/actions/dashboard'

export default async function EmailsPage() {
  const [initialEmails, emailMetrics] = await Promise.all([
    getEmails(),
    getEmailMetrics(),
  ])

  return <CrmDashboard section="emails" initialEmails={initialEmails} emailMetrics={emailMetrics} />
}
