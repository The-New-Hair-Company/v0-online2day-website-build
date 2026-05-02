import { CrmDashboard } from '@/components/crm-dashboard/crm-dashboard'
import { getEmails } from '@/app/actions/dashboard'

export default async function EmailsPage() {
  const initialEmails = await getEmails()
  
  return <CrmDashboard section="emails" initialEmails={initialEmails} />
}
