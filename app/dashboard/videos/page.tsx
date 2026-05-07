import { CrmDashboard } from '@/components/crm-dashboard/crm-dashboard'
import { getCrmSetupConfig, getVideos, getVideoMetrics } from '@/app/actions/dashboard'

export default async function VideosPage() {
  const [initialVideos, videoMetrics, setupConfig] = await Promise.all([
    getVideos(),
    getVideoMetrics(),
    getCrmSetupConfig(),
  ])

  return (
    <CrmDashboard section="videos" initialVideos={initialVideos} videoMetrics={videoMetrics} setupConfig={setupConfig} />
  )
}
