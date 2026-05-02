import { CrmDashboard } from '@/components/crm-dashboard/crm-dashboard'
import { getVideos } from '@/app/actions/dashboard'

export default async function VideosPage() {
  const initialVideos = await getVideos()
  
  return <CrmDashboard section="videos" initialVideos={initialVideos} />
}
