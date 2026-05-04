import LeadsDashboard from '@/components/leads/LeadsDashboard'
import { getLeads, getDashboardMetrics, getTasks, getRecentActivity, getRecommendations } from '@/app/actions/dashboard'

export const metadata = {
  title: 'Leads | Online2Day CRM Dashboard',
  description: 'Lead management workspace for Online2Day.',
}

export default async function DashboardLeadsPage() {
  const initialLeads = await getLeads()
  const { metrics, pipelineStages, pipelineSummary, sourcePerformance, ownerPerformance } = await getDashboardMetrics()
  const tasks = await getTasks()
  const recentActivity = await getRecentActivity()
  const recommendations = await getRecommendations()

  return (
    <LeadsDashboard 
      initialLeads={initialLeads}
      metrics={metrics}
      ownerPerformance={ownerPerformance}
      pipelineStages={pipelineStages}
      pipelineSummary={pipelineSummary}
      processSteps={['Capture lead', 'Qualify', 'Personalise outreach', 'Send video', 'Handle objections', 'Book call', 'Close']}
      recentActivity={recentActivity}
      recommendations={recommendations}
      sourcePerformance={sourcePerformance}
      tasks={tasks}
    />
  )
}
