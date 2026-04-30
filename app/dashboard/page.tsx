import { createClient } from '@/lib/supabase/server'
import { Users, Video, MousePointerClick, Calendar } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Get total leads
  const { count: totalLeads } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })

  // Get new leads (this week)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count: newLeads } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', weekAgo)

  // Get video stats from lead_assets
  const { data: videoStats } = await supabase
    .from('lead_assets')
    .select('id, view_count')
    .eq('type', 'video')

  const videosSent = videoStats?.length ?? 0
  const videoViews = videoStats?.reduce((sum, v) => sum + (v.view_count ?? 0), 0) ?? 0

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-foreground mb-8">Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total CRM Leads</p>
              <h3 className="text-2xl font-bold text-card-foreground">{totalLeads || 0}</h3>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
              <Calendar size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">New This Week</p>
              <h3 className="text-2xl font-bold text-card-foreground">{newLeads || 0}</h3>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-chart-3/10 text-chart-3 rounded-lg flex items-center justify-center">
              <Video size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Videos Sent</p>
              <h3 className="text-2xl font-bold text-card-foreground">{videosSent}</h3>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-chart-5/10 text-chart-5 rounded-lg flex items-center justify-center">
              <MousePointerClick size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Video Views</p>
              <h3 className="text-2xl font-bold text-card-foreground">{videoViews}</h3>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
