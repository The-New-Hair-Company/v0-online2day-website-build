import { EnterpriseCommandCenter } from '@/components/enterprise-suite/enterprise-command-center'
import { getDashboardAccessProfile } from '@/app/actions/dashboard'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Enterprise Command Center | Online2Day',
  description: 'Internal calendar, video calling, governance and operations command center.',
}

export default async function EnterpriseCommandPage() {
  const access = await getDashboardAccessProfile()
  if (!access.canUseSystem || !access.modules.enterprise) {
    redirect('/dashboard/overview')
  }
  return <EnterpriseCommandCenter />
}
