import LeadsDashboard from '@/components/leads/LeadsDashboard'
import { getLeads, getDashboardMetrics, getTasks, getRecentActivity, getRecommendations } from '@/app/actions/dashboard'

export const metadata = {
  title: 'Overview | Online2Day CRM Dashboard',
  description: 'Online2Day dashboard overview.',
}

export default async function DashboardOverviewPage() {
  const initialLeads = await getLeads()
  const { metrics, pipelineStages, sourcePerformance, ownerPerformance } = await getDashboardMetrics()
  const tasks = await getTasks()
  const recentActivity = await getRecentActivity()
  const recommendations = await getRecommendations()

  return (
    <LeadsDashboard 
      section="overview"
      initialLeads={initialLeads}
      metrics={metrics}
      ownerPerformance={ownerPerformance}
      pipelineStages={pipelineStages}
      processSteps={['Capture lead', 'Qualify', 'Personalise outreach', 'Send video', 'Handle objections', 'Book call', 'Close']}
      recentActivity={recentActivity}
      recommendations={recommendations}
      sourcePerformance={sourcePerformance}
      tasks={tasks}
    />
  )
}
