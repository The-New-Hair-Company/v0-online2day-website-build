import { CrmDashboard } from '@/components/crm-dashboard/crm-dashboard'
import { getVideos, getVideoMetrics } from '@/app/actions/dashboard'

export default async function VideosPage() {
  const [initialVideos, videoMetrics] = await Promise.all([
    getVideos(),
    getVideoMetrics(),
  ])

  return <CrmDashboard section="videos" initialVideos={initialVideos} videoMetrics={videoMetrics} />
}
