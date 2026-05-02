import { CrmDashboard } from '@/components/crm-dashboard/crm-dashboard'
import { getEmails, getEmailMetrics, getEmailComposerData } from '@/app/actions/dashboard'

export default async function EmailsPage() {
  const [initialEmails, emailMetrics, emailComposerData] = await Promise.all([
    getEmails(),
    getEmailMetrics(),
    getEmailComposerData(),
  ])

  return <CrmDashboard section="emails" initialEmails={initialEmails} emailMetrics={emailMetrics} emailComposerData={emailComposerData} />
}
