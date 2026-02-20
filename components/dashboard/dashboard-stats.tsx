import { Card } from '@/components/ui/card'
import { FolderOpen, CheckCircle2, Clock, TrendingUp } from 'lucide-react'

interface Project {
  id: string
  status: string
  created_at: string
}

interface DashboardStatsProps {
  projects: Project[]
}

export function DashboardStats({ projects }: DashboardStatsProps) {
  const totalProjects = projects.length
  const completedProjects = projects.filter((p) => p.status === 'completed').length
  const inProgressProjects = projects.filter((p) => p.status === 'in_progress').length
  const draftProjects = projects.filter((p) => p.status === 'draft').length

  return (
    <div className="grid gap-4 md:grid-cols-4 mb-8">
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <FolderOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Projects</p>
            <p className="text-2xl font-bold">{totalProjects}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">In Progress</p>
            <p className="text-2xl font-bold">{inProgressProjects}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="text-2xl font-bold">{completedProjects}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Drafts</p>
            <p className="text-2xl font-bold">{draftProjects}</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
