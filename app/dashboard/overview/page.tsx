import LeadsDashboard from '@/components/leads/LeadsDashboard'

export const metadata = {
  title: 'Overview | Online2Day CRM Dashboard',
  description: 'Online2Day dashboard.',
}

export default function DashboardOverviewPage() {
  return <LeadsDashboard section="overview" />
}
