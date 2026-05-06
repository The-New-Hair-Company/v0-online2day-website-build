import { redirect } from 'next/navigation'
import { getDashboardMetrics } from '@/app/actions/dashboard'
import { getDashboardAccessProfile } from '@/app/actions/dashboard'
import { getReportSnapshots, scanDataQuality } from '@/lib/actions/enterprise-actions'
import { ReportsClient } from './reports-client'

export const metadata = {
  title: 'Reports | Online2Day CRM Dashboard',
  description: 'Leadership reports and export center.',
}

export default async function ReportsPage() {
  const access = await getDashboardAccessProfile()
  if (!access.canUseSystem || !access.modules.reports) {
    redirect('/dashboard/overview')
  }
  const [{ metrics }, quality, snapshots] = await Promise.all([getDashboardMetrics(), scanDataQuality(), getReportSnapshots(12)])
  return <ReportsClient metrics={metrics.map((m) => ({ label: m.label, value: m.value, delta: m.delta }))} dataQuality={quality} snapshots={snapshots} />
}
