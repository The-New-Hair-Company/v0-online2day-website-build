import { CrmDashboard } from '@/components/crm-dashboard/crm-dashboard'
import { getCrmSetupConfig, getEmails, getEmailMetrics, getEmailComposerData, getRecentEmailSends } from '@/app/actions/dashboard'

export default async function EmailsPage() {
  const [initialEmails, emailMetrics, emailComposerData, recentEmailSends, setupConfig] = await Promise.all([
    getEmails(),
    getEmailMetrics(),
    getEmailComposerData(),
    getRecentEmailSends(),
    getCrmSetupConfig(),
  ])

  return <CrmDashboard section="emails" initialEmails={initialEmails} emailMetrics={emailMetrics} emailComposerData={emailComposerData} recentEmailSends={recentEmailSends} setupConfig={setupConfig} />
}
