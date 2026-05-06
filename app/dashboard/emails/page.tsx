import { CrmDashboard } from '@/components/crm-dashboard/crm-dashboard'
import { getCrmSetupConfig, getEmails, getEmailMetrics, getEmailComposerData } from '@/app/actions/dashboard'

export default async function EmailsPage() {
  const [initialEmails, emailMetrics, emailComposerData, setupConfig] = await Promise.all([
    getEmails(),
    getEmailMetrics(),
    getEmailComposerData(),
    getCrmSetupConfig(),
  ])

  return <CrmDashboard section="emails" initialEmails={initialEmails} emailMetrics={emailMetrics} emailComposerData={emailComposerData} setupConfig={setupConfig} />
}
