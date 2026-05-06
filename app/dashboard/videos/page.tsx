import Link from 'next/link'
import { CrmDashboard } from '@/components/crm-dashboard/crm-dashboard'
import { getCrmSetupConfig, getVideos, getVideoMetrics } from '@/app/actions/dashboard'
import { Upload } from 'lucide-react'

export default async function VideosPage() {
  const [initialVideos, videoMetrics, setupConfig] = await Promise.all([
    getVideos(),
    getVideoMetrics(),
    getCrmSetupConfig(),
  ])

  return (
    <div className="relative">
      {/* Upload button — floated above CrmDashboard */}
      <div className="absolute top-6 right-6 z-10">
        <Link
          href="/dashboard/videos/upload"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
        >
          <Upload size={16} />
          Upload Video
        </Link>
      </div>
      <CrmDashboard section="videos" initialVideos={initialVideos} videoMetrics={videoMetrics} setupConfig={setupConfig} />
    </div>
  )
}
